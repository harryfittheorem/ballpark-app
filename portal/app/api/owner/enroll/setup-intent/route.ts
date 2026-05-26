/**
 * POST /api/owner/enroll/setup-intent
 *
 * Creates the appropriate Stripe intent for the kiosk payment step.
 * All payment parameters are loaded SERVER-SIDE from the DB using membership_id —
 * the client has no influence over amount, plan type, or connected account.
 *
 *   EFT plans  → SetupIntent (vault card for recurring billing, no charge now)
 *   OTC plans  → PaymentIntent (charge the full plan amount immediately)
 *
 * Body: {
 *   membership_id: string,
 *   customer_email?: string,   -- informational hint only (for Stripe metadata)
 *   customer_name?: string,
 * }
 *
 * Returns: {
 *   client_secret: string,
 *   intent_type: 'setup' | 'payment',
 *   connected_account_id: string | null,
 * }
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_VERSION = '2024-06-20';

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

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return err(500, 'Stripe not configured');

  let body: { membership_id?: string; customer_email?: string; customer_name?: string } = {};
  try {
    body = await req.json() as typeof body;
  } catch {
    // body optional
  }

  const { membership_id, customer_email, customer_name } = body;
  if (!membership_id) return err(422, 'membership_id required');

  const serviceClient = createServiceClient();

  // ── Load plan + location stripe account from DB (authoritative, never trust client) ──
  // Use families.primary_location_id → locations.stripe_account_id, the same path
  // stripe-create-subscription uses, so all Stripe objects live on the same account.

  const { data: membership } = await serviceClient
    .from('memberships')
    .select('id, tenant_id, plan_type, amount_cents, families!inner(primary_location_id)')
    .eq('id', membership_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!membership) return err(404, 'Membership not found');

  const planType = (membership as { plan_type: string }).plan_type as 'eft' | 'otc';
  const amountCents = (membership as { amount_cents: number }).amount_cents;

  const primaryLocationId = (
    (membership as { families?: { primary_location_id?: string } }).families
  )?.primary_location_id ?? null;

  let connectedAccountId: string | null = null;
  if (primaryLocationId) {
    const { data: location } = await serviceClient
      .from('locations')
      .select('stripe_account_id, stripe_onboarding_status')
      .eq('id', primaryLocationId)
      .single();
    const loc = location as { stripe_account_id?: string; stripe_onboarding_status?: string } | null;
    if (loc?.stripe_onboarding_status === 'connected') {
      connectedAccountId = loc.stripe_account_id ?? null;
    }
  }

  // Hard gate: a connected Stripe account is required. Without it, any intent
  // created would land on the platform account instead of the tenant's account.
  if (!connectedAccountId) {
    return err(422, 'Stripe account not configured for this location. Complete Stripe Connect onboarding before enrolling members.');
  }

  const stripeHeaders: Record<string, string> = {
    Authorization: `Bearer ${stripeKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_VERSION,
  };
  if (connectedAccountId) stripeHeaders['Stripe-Account'] = connectedAccountId;

  let clientSecret: string;
  const intentType: 'setup' | 'payment' = planType === 'otc' ? 'payment' : 'setup';

  if (intentType === 'payment') {
    // OTC: PaymentIntent — charge the DB-sourced amount immediately
    if (!amountCents || amountCents <= 0) {
      return err(422, 'Plan amount must be greater than zero for OTC payment');
    }
    const params = new URLSearchParams({
      amount: String(amountCents),
      currency: 'usd',
      'payment_method_types[]': 'card',
      capture_method: 'automatic',
      'metadata[membership_id]': membership_id,
    });
    if (customer_email) params.append('metadata[customer_email]', customer_email);
    if (customer_name) params.append('metadata[customer_name]', customer_name);

    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: stripeHeaders,
      body: params.toString(),
    });
    const piData = await piRes.json() as { client_secret?: string; error?: { message?: string } };

    if (!piRes.ok || !piData.client_secret) {
      const msg = piData.error?.message ?? `Stripe error ${piRes.status}`;
      console.error('[enroll/setup-intent] PaymentIntent error:', msg);
      return err(502, `Could not create payment: ${msg}`);
    }
    clientSecret = piData.client_secret;
  } else {
    // EFT: SetupIntent — vault card for recurring billing
    const params = new URLSearchParams({
      usage: 'off_session',
      'payment_method_types[]': 'card',
      'metadata[membership_id]': membership_id,
    });
    if (customer_email) params.append('metadata[customer_email]', customer_email);
    if (customer_name) params.append('metadata[customer_name]', customer_name);

    const siRes = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: stripeHeaders,
      body: params.toString(),
    });
    const siData = await siRes.json() as { client_secret?: string; error?: { message?: string } };

    if (!siRes.ok || !siData.client_secret) {
      const msg = siData.error?.message ?? `Stripe error ${siRes.status}`;
      console.error('[enroll/setup-intent] SetupIntent error:', msg);
      return err(502, `Could not create payment setup: ${msg}`);
    }
    clientSecret = siData.client_secret;
  }

  return NextResponse.json({
    client_secret: clientSecret,
    intent_type: intentType,
    connected_account_id: connectedAccountId,
  });
}
