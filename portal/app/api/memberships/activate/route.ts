/**
 * POST /api/memberships/activate
 *
 * Combined membership activation endpoint. Behaviour depends on plan type and
 * whether the family has a saved payment method:
 *
 * EFT + has payment method (stripe_connected_customer_id):
 *   1. Try to create the Stripe Subscription FIRST.
 *   2. Only mark membership active AFTER Stripe succeeds.
 *   Returns 502 if Stripe fails — membership stays in its prior status so the
 *   operator can retry once the family has a valid card.
 *
 * All other cases (no payment method, not EFT, already has subscription):
 *   - Mark membership active immediately.
 *   - Stripe skipped (stripe_skipped=true in response).
 *
 * Body: { membership_id: string }
 *
 * Returns:
 *   { ok: true, subscription_id?: string, next_billing_at?: string }  — success
 *   { ok: true, stripe_skipped: true, reason: string }                — skipped
 *   { error: string }   with non-2xx status                           — failure
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  let body: { membership_id?: string };
  try {
    body = await req.json();
  } catch {
    return err(400, 'Invalid JSON body');
  }

  const { membership_id } = body;
  if (!membership_id) return err(422, 'membership_id required');

  // ── 1. Load membership (tenant-scoped) ──────────────────────────────────────
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select('id, plan_type, status, stripe_subscription_id, family_id, tenant_id, families!inner(stripe_connected_customer_id)')
    .eq('id', membership_id)
    .eq('tenant_id', tenantId)
    .single();

  if (memErr || !mem) return err(404, 'Membership not found or access denied');

  const fam = mem.families as unknown as { stripe_connected_customer_id: string | null };
  const hasPaymentMethod = Boolean(fam.stripe_connected_customer_id);

  // Determine whether Stripe subscription creation should be attempted.
  // Conditions: EFT plan + family has a saved connected-account customer.
  // We do NOT gate on !stripe_subscription_id here because a cancelled/expired
  // subscription stays on the row but is no longer valid for billing — the
  // edge function handles idempotency: it checks the live Stripe status and
  // creates a new subscription if the existing one is no longer usable.
  const shouldCreateSubscription =
    mem.plan_type === 'eft' &&
    hasPaymentMethod;

  if (!shouldCreateSubscription) {
    // No Stripe attempt — just activate membership directly.
    // (No payment method saved yet, or not an EFT plan.)
    if (mem.status !== 'active') {
      const { error: updateErr } = await supabase
        .from('memberships')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', membership_id)
        .eq('tenant_id', tenantId);

      if (updateErr) return err(500, `DB error: ${updateErr.message}`);
    }

    return NextResponse.json({
      ok: true,
      stripe_skipped: true,
      reason: !hasPaymentMethod ? 'no_payment_method' : 'not_eft_plan',
    });
  }

  // ── EFT + has payment method: Stripe first, then mark active ────────────────
  // We create the Stripe Subscription before marking the membership active.
  // If Stripe fails, the membership stays in its current status and we return a
  // 502 error so the operator knows billing was not started. This avoids the
  // situation where a membership shows "active" but has no billing linked.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return err(500, 'NEXT_PUBLIC_SUPABASE_URL not configured');
  }

  let subscriptionId: string;
  let nextBillingAt: string | null;
  let stripeStatus: string | null = null;

  try {
    const fnRes = await fetch(`${supabaseUrl}/functions/v1/stripe-create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ membership_id }),
    });

    const fnData = await fnRes.json() as {
      subscription_id?: string;
      next_billing_at?: string;
      status?: string;
      error?: { message?: string };
    };

    if (!fnRes.ok || !fnData.subscription_id) {
      const msg = typeof fnData.error === 'object'
        ? fnData.error?.message
        : String(fnData.error ?? `Edge function error ${fnRes.status}`);
      console.error('[memberships/activate] stripe-create-subscription failed:', msg);
      // Membership is NOT marked active — operator must resolve billing before retrying.
      return NextResponse.json(
        { error: `Could not start Stripe billing: ${msg}. Membership was not activated. Please ensure the family has saved a payment card, then try again.` },
        { status: 502 },
      );
    }

    subscriptionId = fnData.subscription_id;
    nextBillingAt = fnData.next_billing_at ?? null;
    stripeStatus = fnData.status ?? null;
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
    console.error('[memberships/activate] fetch error:', msg);
    return NextResponse.json(
      { error: `Could not reach Stripe billing service: ${msg}. Membership was not activated.` },
      { status: 502 },
    );
  }

  // Only mark membership active when Stripe confirms the subscription is in a
  // paying state (active or trialing). If Stripe returned incomplete/past_due,
  // stripe-create-subscription already set payment_overdue — we must NOT
  // override that, because doing so would mask a first-invoice payment failure
  // until the webhook arrives (which may be delayed or missed).
  // For any other status, we also leave the DB status alone.
  const stripeConfirmedActive = stripeStatus === 'active' || stripeStatus === 'trialing';
  if (stripeConfirmedActive && mem.status !== 'active') {
    const { error: updateErr } = await supabase
      .from('memberships')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', membership_id)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      console.error('[memberships/activate] DB activate update failed:', updateErr.message);
      // Subscription was created — don't fail the request, just log.
    }
  }

  return NextResponse.json({
    ok: true,
    subscription_id: subscriptionId,
    next_billing_at: nextBillingAt,
    subscription_status: stripeStatus,
  });
}
