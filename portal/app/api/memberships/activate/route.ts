/**
 * POST /api/memberships/activate
 *
 * Combined membership activation endpoint. Behaviour depends on plan type and
 * whether the family has a saved payment method:
 *
 * EFT + has payment method (stripe_connected_customer_id):
 *   1. Validate promo code (read-only preview) if provided — get stripe_promotion_code_id.
 *      Passes plan_name so PLAN_MISMATCH fires if applicable_plan_names is set.
 *   2. Try to create the Stripe Subscription FIRST (with promotion code if provided).
 *   3. Only mark membership active AFTER Stripe succeeds.
 *   4. Atomically consume promo code (consume_promo_code RPC, SELECT FOR UPDATE):
 *      - On success: redemptions_used incremented, done.
 *      - On EXHAUSTED: a concurrent activation beat us to the last redemption.
 *        We immediately cancel the just-created Stripe subscription to compensate
 *        (prevents over-redemption at the billing level), then return 422.
 *      - On any other error: non-fatal, log only — subscription is already live.
 *   Returns 502 if Stripe subscription creation fails (membership unchanged).
 *
 * All other cases (no payment method, not EFT):
 *   - Mark membership active immediately (Stripe skipped).
 *
 * Body: { membership_id: string, promo_code?: string }
 *
 * Returns:
 *   { ok: true, subscription_id, next_billing_at, subscription_status }  — EFT success
 *   { ok: true, stripe_skipped: true, reason: string }                   — non-EFT
 *   { error: string }  with 4xx/5xx                                      — failure
 */

import { type NextRequest, NextResponse } from 'next/server';
import { enrollmentAuth } from '@/lib/enrollmentAuth';
import { readAppRole, readTenantId } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/serviceClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_VERSION = '2024-06-20';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

const PROMO_ERROR_MESSAGES: Record<string, string> = {
  INVALID: 'This promo code is invalid.',
  EXPIRED: 'This promo code has expired.',
  EXHAUSTED: 'This promo code has reached its maximum number of uses.',
  PLAN_MISMATCH: 'This promo code does not apply to this membership plan.',
  FORBIDDEN: 'Not authorized to use promo codes.',
};

/**
 * Cancel a Stripe subscription immediately (best-effort compensating action).
 * Used when consume_promo_code returns EXHAUSTED after the subscription was created.
 */
async function cancelStripeSubscription(
  subscriptionId: string,
  stripeKey: string,
): Promise<void> {
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': STRIPE_VERSION,
        },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(
        '[memberships/activate] compensating Stripe cancel failed:',
        res.status,
        body,
      );
    }
  } catch (e) {
    console.error(
      '[memberships/activate] compensating Stripe cancel threw:',
      e instanceof Error ? e.message : String(e),
    );
  }
}

export async function POST(req: NextRequest) {
  const { supabase, session } = await enrollmentAuth(req);
  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  let body: { membership_id?: string; promo_code?: string };
  try {
    body = await req.json();
  } catch {
    return err(400, 'Invalid JSON body');
  }

  const { membership_id, promo_code } = body;
  if (!membership_id) return err(422, 'membership_id required');

  const trimmedPromoCode = promo_code?.trim() || null;

  // ── 1. Load membership (tenant-scoped, include plan_name for promo plan check) ──
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select('id, plan_name, plan_type, status, stripe_subscription_id, family_id, tenant_id, families!inner(stripe_connected_customer_id)')
    .eq('id', membership_id)
    .eq('tenant_id', tenantId)
    .single();

  if (memErr || !mem) return err(404, 'Membership not found or access denied');
  // Authenticated staff have SELECT-only access to billing tables. Keep that
  // boundary: after verified role/tenant and RLS-scoped membership lookup,
  // perform narrowly tenant-scoped writes exclusively on the server.
  const billingClient = createServiceClient();

  const fam = mem.families as unknown as { stripe_connected_customer_id: string | null };
  const hasPaymentMethod = Boolean(fam.stripe_connected_customer_id);
  const planName = (mem.plan_name as string | null) ?? null;

  // ── 2. Validate promo code (read-only — get stripe_promotion_code_id) ─────────
  // Passes plan_name so PLAN_MISMATCH fires when applicable_plan_names is non-empty
  // and this plan is not in the allowed list.
  // Actual atomic consumption (with row lock) happens AFTER Stripe succeeds.
  let stripePromotionCodeId: string | null = null;

  if (trimmedPromoCode) {
    const { data: promoResult, error: promoErr } = await supabase.rpc(
      'validate_promo_code',
      {
        p_code: trimmedPromoCode,
        p_plan_name: planName,
      },
    );

    if (promoErr) {
      console.error('[memberships/activate] validate_promo_code error:', promoErr.message);
      return err(500, `Promo code validation error: ${promoErr.message}`);
    }

    const result = promoResult as {
      ok: boolean;
      error_code?: string;
      stripe_promotion_code_id?: string;
    };

    if (!result.ok) {
      const errorCode = result.error_code ?? 'INVALID';
      const message = PROMO_ERROR_MESSAGES[errorCode] ?? 'This promo code is invalid.';
      return err(422, message);
    }

    stripePromotionCodeId = result.stripe_promotion_code_id ?? null;
  }

  // ── 3. Determine whether Stripe should be attempted ─────────────────────────
  const shouldCreateSubscription = mem.plan_type === 'eft' && hasPaymentMethod;

  if (!shouldCreateSubscription) {
    if (mem.status !== 'active') {
      const { error: updateErr } = await billingClient
        .from('memberships')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', membership_id)
        .eq('tenant_id', tenantId)
        .select('id')
        .single();

      if (updateErr) return err(500, `DB error: ${updateErr.message}`);
    }

    return NextResponse.json({
      ok: true,
      stripe_skipped: true,
      reason: !hasPaymentMethod ? 'no_payment_method' : 'not_eft_plan',
    });
  }

  // ── 4. EFT + payment method: create Stripe subscription ─────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!supabaseUrl) return err(500, 'NEXT_PUBLIC_SUPABASE_URL not configured');

  let subscriptionId: string;
  let nextBillingAt: string | null;
  let stripeStatus: string | null = null;
  let recoveryIntent: { client_secret: string; connected_account_id: string; intent_type: 'payment'; payment_status?: string } | undefined;

  try {
    const fnBody: Record<string, unknown> = { membership_id };
    if (stripePromotionCodeId) fnBody.stripe_promotion_code_id = stripePromotionCodeId;

    const fnRes = await fetch(`${supabaseUrl}/functions/v1/stripe-create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(fnBody),
    });

    const fnData = await fnRes.json() as {
      subscription_id?: string;
      next_billing_at?: string;
      status?: string;
      payment_intent_client_secret?: string | null;
      connected_account_id?: string;
      payment_intent_status?: string;
      error?: { message?: string };
    };

    if (!fnRes.ok || !fnData.subscription_id) {
      const msg = typeof fnData.error === 'object'
        ? fnData.error?.message
        : String(fnData.error ?? `Edge function error ${fnRes.status}`);
      console.error('[memberships/activate] stripe-create-subscription failed:', msg);
      return NextResponse.json(
        {
          error: `Could not start Stripe billing: ${msg}. Membership was not activated. ` +
            `Please ensure the family has saved a payment card, then try again.`,
        },
        { status: 502 },
      );
    }

    subscriptionId = fnData.subscription_id;
    nextBillingAt = fnData.next_billing_at ?? null;
    stripeStatus = fnData.status ?? null;
    if (fnData.payment_intent_client_secret && fnData.connected_account_id) {
      recoveryIntent = {
        client_secret: fnData.payment_intent_client_secret,
        connected_account_id: fnData.connected_account_id,
        intent_type: 'payment',
        payment_status: fnData.payment_intent_status,
      };
    }
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
    console.error('[memberships/activate] fetch error:', msg);
    return NextResponse.json(
      {
        error: `Could not reach Stripe billing service: ${msg}. Membership was not activated.`,
      },
      { status: 502 },
    );
  }

  // ── 5. Mark membership active ────────────────────────────────────────────────
  const stripeConfirmedActive = stripeStatus === 'active' || stripeStatus === 'trialing';
  const { error: updateErr } = await billingClient
    .from('memberships')
    .update({
      stripe_subscription_id: subscriptionId,
      ...(nextBillingAt ? { next_billing_at: nextBillingAt } : {}),
      ...(stripeConfirmedActive ? { status: 'active' } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership_id)
    .eq('tenant_id', tenantId)
    .select('id')
    .single();
  if (updateErr) {
    console.error('[memberships/activate] DB activate update failed:', updateErr.message);
    return err(500, 'Stripe billing was created but its membership link could not be saved. Retry confirmation, not a new enrollment.');
  }

  // ── 6. Atomically consume promo code (SELECT FOR UPDATE) ──────────────────────
  // consume_promo_code re-validates the code under a row lock and atomically
  // increments redemptions_used, preventing concurrent over-redemption.
  //
  // Called AFTER Stripe succeeds so redemptions are never counted for failed billings.
  //
  // EXHAUSTED edge case: a concurrent activation consumed the last redemption between
  // our validate (step 2) and here. We cancel the just-created Stripe subscription as
  // a compensating action to prevent the discount being applied when it shouldn't be.
  if (trimmedPromoCode) {
    const { data: consumeResult, error: consumeErr } = await supabase.rpc(
      'consume_promo_code',
      {
        p_code: trimmedPromoCode,
        p_plan_name: planName,
      },
    );

    if (consumeErr) {
      // Non-fatal: subscription is live, log and continue
      console.error('[memberships/activate] consume_promo_code RPC error:', consumeErr.message);
    } else {
      const result = consumeResult as { ok: boolean; error_code?: string };
      if (!result.ok && result.error_code === 'EXHAUSTED') {
        // Compensate: cancel the subscription that was created with the discount
        if (stripeKey) {
          await cancelStripeSubscription(subscriptionId, stripeKey);
        }
        return err(
          422,
          'This promo code was just fully redeemed by another activation. ' +
            'The subscription has been cancelled. Please try again without a promo code ' +
            'or contact support.',
        );
      } else if (!result.ok) {
        // Other errors (INVALID, EXPIRED, etc.) after Stripe success — log only
        console.warn(
          '[memberships/activate] consume_promo_code non-exhausted failure:',
          result.error_code,
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    subscription_id: subscriptionId,
    next_billing_at: nextBillingAt,
    subscription_status: stripeStatus,
    ...(recoveryIntent ? { recovery_intent: recoveryIntent } : {}),
  });
}
