// =============================================================================
// supabase/functions/stripe-webhook/index.ts
// =============================================================================
// Task #188 — Stripe Connect Phase 1
//
// Auth model: NO Supabase JWT on this endpoint. Authentication is the
// Stripe-Signature header verified against STRIPE_WEBHOOK_SECRET using
// Stripe's HMAC-SHA256 scheme with a 300-second replay window.
//
// Deploy with:
//   npx supabase functions deploy stripe-webhook --no-verify-jwt
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY      (sk_live_... or sk_test_...)
//   STRIPE_WEBHOOK_SECRET  (whsec_... from Stripe Dashboard → Webhooks)
//   SUPABASE_URL           (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//
// Handled events:
//   account.updated           → sync stripe_onboarding_status on locations
//   payment_intent.succeeded  → stub (Phase 2)
//   payment_intent.payment_failed → stub (Phase 2)
//
// All unrecognized events get a 200 {ignored:true} so Stripe stops retrying.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REPLAY_TOLERANCE_SECONDS = 300;

// ─── HMAC-SHA256 signature verification ──────────────────────────────────────

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(',');
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) return false;

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > REPLAY_TOLERANCE_SECONDS) return false;

  const payload = `${timestamp}.${rawBody}`;
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some(sig => {
    // Constant-time comparison via XOR
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Onboarding status mapping ───────────────────────────────────────────────
// Stripe account.updated carries `charges_enabled`, `payouts_enabled`,
// and `requirements.disabled_reason`. Map those to our simplified status.

function deriveOnboardingStatus(account: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: { disabled_reason?: string | null };
}): 'not_connected' | 'pending' | 'connected' | 'restricted' {
  if (account.charges_enabled && account.payouts_enabled) return 'connected';
  if (account.requirements?.disabled_reason) return 'restricted';
  return 'pending';
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: { code: 'method_not_allowed', message: 'POST only' } }, 405);
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set');
    return json({ error: { code: 'config_error', message: 'Webhook secret not configured' } }, 500);
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('stripe-signature') ?? '';

  const valid = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!valid) {
    console.warn('[stripe-webhook] Signature verification failed');
    return json({ error: { code: 'invalid_signature', message: 'Stripe-Signature verification failed' } }, 401);
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: { code: 'bad_json', message: 'Could not parse event body' } }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`[stripe-webhook] event=${event.type}`);

  // ── account.updated ───────────────────────────────────────────────────────
  if (event.type === 'account.updated') {
    const account = event.data.object as {
      id: string;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
      business_profile?: { name?: string };
      settings?: {
        dashboard?: { display_name?: string };
        payouts?: { schedule?: { interval?: string; monthly_anchor?: number; weekly_anchor?: string } };
      };
      email?: string;
      requirements?: { disabled_reason?: string | null };
    };

    const status = deriveOnboardingStatus(account);
    const accountName =
      account.business_profile?.name ??
      account.settings?.dashboard?.display_name ??
      account.email ??
      null;

    // Derive human-readable payout schedule
    let payoutInterval: string | null = null;
    const schedule = account.settings?.payouts?.schedule;
    if (schedule?.interval) {
      if (schedule.interval === 'daily') payoutInterval = 'Daily';
      else if (schedule.interval === 'weekly') payoutInterval = `Weekly (${schedule.weekly_anchor ?? 'Friday'})`;
      else if (schedule.interval === 'monthly') payoutInterval = `Monthly (${schedule.monthly_anchor ?? 1}st)`;
      else payoutInterval = schedule.interval;
    }

    const updates: Record<string, string | null> = {
      stripe_onboarding_status: status,
      updated_at: new Date().toISOString(),
    };
    if (accountName) updates.stripe_account_name = accountName;
    if (payoutInterval) updates.stripe_payout_interval = payoutInterval;

    const { error: dbErr } = await supabase
      .from('locations')
      .update(updates)
      .eq('stripe_account_id', account.id);

    if (dbErr) {
      console.error('[stripe-webhook] account.updated DB error:', dbErr.message);
      return json({ error: { code: 'db_error', message: dbErr.message } }, 500);
    }

    console.log(`[stripe-webhook] account.updated → ${account.id} status=${status}`);
    return json({ ok: true });
  }

  // ── payment_intent.succeeded (Phase 2 stub) ───────────────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string; amount: number; currency: string };
    console.log(`[stripe-webhook] payment_intent.succeeded id=${pi.id} amount=${pi.amount} ${pi.currency} (Phase 2 stub)`);
    return json({ ok: true });
  }

  // ── payment_intent.payment_failed (Phase 2 stub) ──────────────────────────
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as { id: string };
    console.log(`[stripe-webhook] payment_intent.payment_failed id=${pi.id} (Phase 2 stub)`);
    return json({ ok: true });
  }

  // ── All other events — acknowledge so Stripe stops retrying ───────────────
  console.log(`[stripe-webhook] ignored event type=${event.type}`);
  return json({ ok: true, ignored: true, reason: `Unhandled event type: ${event.type}` });
});
