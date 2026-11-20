/**
 * POST /api/owner/enroll/setup-intent
 *
 * Creates the appropriate Stripe intent for the kiosk payment step.
 * All payment parameters are loaded SERVER-SIDE from the DB using membership_id —
 * the client has no influence over amount, plan type, or connected account.
 *
 *   EFT plans           → SetupIntent (vault card for recurring billing, no charge now)
 *   OTC plans           → PaymentIntent (charge the full plan amount immediately)
 *   OTC + split         → PaymentIntent for deposit_amount_cents only
 *   OTC + deferred      → SetupIntent (vault card, full charge on deferred_charge_date)
 *
 * Body: {
 *   membership_id: string,
 *   customer_email?: string,
 *   customer_name?: string,
 *   split_deposit_cents?: number,   -- OTC only; deposit amount to charge now
 *   split_due_date?: string,        -- OTC split only; YYYY-MM-DD, 1–90 days out
 *   deferred?: boolean,             -- OTC only; vault card, charge full amount later
 *   deferred_charge_date?: string,  -- OTC deferred only; YYYY-MM-DD, 1–90 days out
 * }
 *
 * Returns: {
 *   client_secret: string,
 *   intent_type: 'setup' | 'payment',
 *   connected_account_id: string | null,
 *   is_split: boolean,
 *   split_balance_cents: number | null,
 *   split_due_date: string | null,
 *   is_deferred: boolean,
 *   deferred_amount_cents: number | null,
 *   deferred_charge_date: string | null,
 * }
 */
import { type NextRequest, NextResponse } from 'next/server';
import { enrollmentAuth, isMobileEnrollment } from '@/lib/enrollmentAuth';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_VERSION = '2024-06-20';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const { session } = await enrollmentAuth(req);

  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return err(500, 'Stripe not configured');

  let body: {
    membership_id?: string;
    customer_email?: string;
    customer_name?: string;
    split_deposit_cents?: number;
    split_due_date?: string;
    deferred?: boolean;
    deferred_charge_date?: string;
  } = {};
  try {
    body = await req.json() as typeof body;
  } catch {
    // body optional
  }

  const { membership_id, customer_email, customer_name, split_deposit_cents, split_due_date, deferred, deferred_charge_date } = body;
  if (!membership_id) return err(422, 'membership_id required');

  const serviceClient = createServiceClient();

  // ── Load plan + location stripe account from DB (authoritative, never trust client) ──
  const { data: membership } = await serviceClient
    .from('memberships')
    .select('id, tenant_id, plan_type, amount_cents, families!inner(primary_location_id)')
    .eq('id', membership_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!membership) return err(404, 'Membership not found');

  const planType = (membership as { plan_type: string }).plan_type as 'eft' | 'otc';
  const amountCents = (membership as { amount_cents: number }).amount_cents;

  // Validate split params (only allowed for OTC)
  let isSplit = false;
  let splitBalanceCents: number | null = null;
  let validatedDepositCents: number | null = null;
  let validatedDueDate: string | null = null;

  if (planType === 'otc' && split_deposit_cents != null) {
    if (!Number.isInteger(split_deposit_cents) || split_deposit_cents <= 0) {
      return err(422, 'split_deposit_cents must be a positive integer');
    }
    if (split_deposit_cents >= amountCents) {
      return err(422, 'Deposit must be less than the total plan amount');
    }
    if (!split_due_date) {
      return err(422, 'split_due_date required when split_deposit_cents is provided');
    }
    const dueDate = new Date(split_due_date + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 1 || diffDays > 90) {
      return err(422, 'Balance due date must be 1–90 days from today');
    }

    isSplit = true;
    validatedDepositCents = split_deposit_cents;
    splitBalanceCents = amountCents - split_deposit_cents;
    validatedDueDate = split_due_date;
  }

  // Validate deferred params (only allowed for OTC, mutually exclusive with split)
  let isDeferred = false;
  let validatedDeferredDate: string | null = null;

  if (planType === 'otc' && deferred && !isSplit) {
    if (!deferred_charge_date) {
      return err(422, 'deferred_charge_date required when deferred is true');
    }
    const deferDate = new Date(deferred_charge_date + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.round((deferDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 1 || diffDays > 90) {
      return err(422, 'Deferred charge date must be 1–90 days from today');
    }
    isDeferred = true;
    validatedDeferredDate = deferred_charge_date;
  }

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

  // Fallback: search tenant for any connected location
  if (!connectedAccountId && !isMobileEnrollment(req)) {
    const { data: fallbackLocs } = await serviceClient
      .from('locations')
      .select('stripe_account_id')
      .eq('tenant_id', tenantId)
      .eq('stripe_onboarding_status', 'connected')
      .limit(1);
    const fb = (fallbackLocs as Array<{ stripe_account_id?: string }> | null)?.[0];
    if (fb?.stripe_account_id) {
      connectedAccountId = fb.stripe_account_id;
    }
  }

  if (!connectedAccountId) {
    return err(422, 'Stripe account not configured for this location. Complete Stripe Connect onboarding before enrolling members.');
  }

  const stripeHeaders: Record<string, string> = {
    Authorization: `Bearer ${stripeKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_VERSION,
  };
  if (connectedAccountId) stripeHeaders['Stripe-Account'] = connectedAccountId;
  if (isMobileEnrollment(req)) stripeHeaders['Idempotency-Key'] = `mobile-enroll-intent-${membership_id}`;

  let clientSecret: string;
  // Deferred OTC uses a SetupIntent (vault only, charge fires later via cron)
  const intentType: 'setup' | 'payment' = (planType === 'otc' && !isDeferred) ? 'payment' : 'setup';

  if (intentType === 'payment') {
    // OTC: PaymentIntent — charge deposit (split) or full amount (non-split)
    const chargeAmount = isSplit ? validatedDepositCents! : amountCents;
    if (!chargeAmount || chargeAmount <= 0) {
      return err(422, 'Plan amount must be greater than zero for OTC payment');
    }
    const params = new URLSearchParams({
      amount: String(chargeAmount),
      currency: 'usd',
      'payment_method_types[]': 'card',
      capture_method: 'automatic',
      'metadata[membership_id]': membership_id,
      'metadata[is_split]': isSplit ? 'true' : 'false',
    });
    if (isSplit) {
      params.append('metadata[split_deposit_cents]', String(validatedDepositCents));
      params.append('metadata[split_balance_cents]', String(splitBalanceCents));
      params.append('metadata[split_due_date]', validatedDueDate!);
    }
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
    // EFT or deferred OTC: SetupIntent — vault card (no charge now)
    const params = new URLSearchParams({
      usage: 'off_session',
      'payment_method_types[]': 'card',
      'metadata[membership_id]': membership_id,
    });
    if (isDeferred) {
      params.append('metadata[is_deferred]', 'true');
      params.append('metadata[deferred_charge_date]', validatedDeferredDate!);
      params.append('metadata[deferred_amount_cents]', String(amountCents));
    }
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
    is_split: isSplit,
    split_balance_cents: splitBalanceCents,
    split_due_date: validatedDueDate,
    is_deferred: isDeferred,
    deferred_amount_cents: isDeferred ? amountCents : null,
    deferred_charge_date: validatedDeferredDate,
  });
}
