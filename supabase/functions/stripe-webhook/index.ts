// =============================================================================
// supabase/functions/stripe-webhook/index.ts
// =============================================================================
// Task #188 — Stripe Connect Phase 1
// Task #72  — Stripe Connect Phase 2 (payment_intent fulfillment)
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
//   account.updated               → sync stripe_onboarding_status on locations
//   payment_intent.succeeded      → mark order 'ordered' + record amount_paid_cents
//   payment_intent.payment_failed → mark order payment_failed + log reason
//   payment_intent.canceled       → mark order 'cancelled' (user dismissed payment sheet)
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

  // ── payment_intent.succeeded ──────────────────────────────────────────────
  // Transition the matching order from payment_pending → ordered.
  // 'ordered' means payment confirmed; the parent shows the QR code at the
  // front desk, where staff scans it via mark_redemption_fulfilled → 'fulfilled'.
  // This matches the points-based flow exactly — `fulfilled` always means
  // physical handoff complete, not just payment received.
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as {
      id: string;
      amount: number;
      currency: string;
      amount_received?: number;
    };

    const amountCents = pi.amount_received ?? pi.amount;

    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('id, status, payment_method, product_id')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle();

    if (findErr) {
      console.error('[stripe-webhook] payment_intent.succeeded find error:', findErr.message);
      return json({ error: { code: 'db_error', message: findErr.message } }, 500);
    }

    if (!order) {
      // No matching order — could be from another system (Phase 3 subscriptions, etc.)
      console.log(`[stripe-webhook] payment_intent.succeeded: no order for pi=${pi.id}, ignoring`);
      return json({ ok: true, ignored: true, reason: 'No order found for this PaymentIntent' });
    }

    if (order.status === 'ordered' || order.status === 'fulfilled') {
      // Idempotent — already transitioned (prevents double inventory decrement)
      console.log(`[stripe-webhook] payment_intent.succeeded: order=${order.id} already ${order.status}`);
      return json({ ok: true });
    }

    // Allow transition from both payment_pending AND payment_failed.
    // Stripe may fire payment_intent.payment_failed for a retried attempt and
    // then payment_intent.succeeded when the retry succeeds. In that case the
    // success event must win and override the earlier failure state.
    // All other terminal states (cancelled, refunded) are left untouched.
    const allowedFromStatuses = ['payment_pending', 'payment_failed'];
    if (!allowedFromStatuses.includes(order.status)) {
      console.log(`[stripe-webhook] payment_intent.succeeded: order=${order.id} in terminal status ${order.status}, ignoring`);
      return json({ ok: true });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'ordered',
        amount_paid_cents: amountCents,
        failure_reason: null,   // clear any earlier failure reason
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .in('status', allowedFromStatuses)  // race-safe: only these statuses
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('[stripe-webhook] payment_intent.succeeded update error:', updateErr.message);
      return json({ error: { code: 'db_error', message: updateErr.message } }, 500);
    }

    if (!updated) {
      // Another webhook delivery already transitioned this order concurrently
      console.log(`[stripe-webhook] payment_intent.succeeded: order=${order.id} already transitioned by concurrent delivery`);
      return json({ ok: true });
    }

    // Inventory was already atomically reserved by stripe-create-payment-intent
    // before the Stripe PI was created, so no further decrement is needed here.
    // The reserve_product_inventory RPC decremented inventory_count at PI
    // creation time — this webhook only finalises the order status.

    console.log(`[stripe-webhook] payment_intent.succeeded → order=${order.id} ordered amount=${amountCents}`);
    return json({ ok: true });
  }

  // ── payment_intent.payment_failed ─────────────────────────────────────────
  // Mark the matching order as payment_failed so the portal can surface it.
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as {
      id: string;
      last_payment_error?: {
        code?: string;
        message?: string;
        decline_code?: string;
      };
    };

    const failureReason =
      pi.last_payment_error?.message ??
      pi.last_payment_error?.code ??
      'Card declined';

    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('id, status, product_id')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle();

    if (findErr) {
      console.error('[stripe-webhook] payment_intent.payment_failed find error:', findErr.message);
      return json({ error: { code: 'db_error', message: findErr.message } }, 500);
    }

    if (!order) {
      console.log(`[stripe-webhook] payment_intent.payment_failed: no order for pi=${pi.id}, ignoring`);
      return json({ ok: true, ignored: true, reason: 'No order found for this PaymentIntent' });
    }

    if (order.status === 'payment_failed') {
      // Idempotent
      return json({ ok: true });
    }

    // Only transition from payment_pending → payment_failed.
    // If a prior payment_intent.succeeded already moved this to ordered/fulfilled,
    // the success event wins — do not overwrite with a stale failure.
    if (order.status !== 'payment_pending') {
      console.log(`[stripe-webhook] payment_intent.payment_failed: order=${order.id} in non-pending status ${order.status}, ignoring`);
      return json({ ok: true });
    }

    const { data: failedUpdate, error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'payment_failed',
        failure_reason: failureReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'payment_pending')   // state guard: never overwrite ordered/fulfilled
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('[stripe-webhook] payment_intent.payment_failed update error:', updateErr.message);
      return json({ error: { code: 'db_error', message: updateErr.message } }, 500);
    }

    // Restore the inventory reservation that was made at PI creation time.
    // Only runs if we actually changed the status (failedUpdate is non-null).
    // Idempotent: restore_product_inventory only increments finite-stock items.
    if (failedUpdate && order.product_id) {
      const { error: restoreErr } = await supabase.rpc('restore_product_inventory', {
        p_product_id: order.product_id,
      });
      if (restoreErr) {
        console.error(`[stripe-webhook] restore_product_inventory (payment_failed) failed for product=${order.product_id}:`, restoreErr.message);
      }
    }

    console.log(`[stripe-webhook] payment_intent.payment_failed → order=${order.id} reason="${failureReason}"`);
    return json({ ok: true });
  }

  // ── payment_intent.canceled ───────────────────────────────────────────────
  // Parent dismissed the payment sheet or the PaymentIntent timed out.
  // Cancel the pending order so it does not appear in order history.
  if (event.type === 'payment_intent.canceled') {
    const pi = event.data.object as { id: string };

    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('id, status, product_id')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle();

    if (findErr) {
      console.error('[stripe-webhook] payment_intent.canceled find error:', findErr.message);
      return json({ error: { code: 'db_error', message: findErr.message } }, 500);
    }

    if (!order) {
      console.log(`[stripe-webhook] payment_intent.canceled: no order for pi=${pi.id}, ignoring`);
      return json({ ok: true, ignored: true, reason: 'No order found for this PaymentIntent' });
    }

    if (order.status === 'cancelled') {
      return json({ ok: true });
    }

    // Only cancel from payment_pending. If the order already transitioned to
    // ordered/fulfilled (e.g., due to a race between cancel and success), the
    // confirmed payment wins and the cancel event is a no-op.
    if (order.status !== 'payment_pending') {
      console.log(`[stripe-webhook] payment_intent.canceled: order=${order.id} in non-pending status ${order.status}, ignoring`);
      return json({ ok: true });
    }

    const { data: cancelledUpdate, error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'payment_pending')   // state guard: never cancel ordered/fulfilled
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('[stripe-webhook] payment_intent.canceled update error:', updateErr.message);
      return json({ error: { code: 'db_error', message: updateErr.message } }, 500);
    }

    // Restore the inventory reservation made at PI creation time.
    // Only runs if we actually changed the status (cancelledUpdate is non-null).
    if (cancelledUpdate && order.product_id) {
      const { error: restoreErr } = await supabase.rpc('restore_product_inventory', {
        p_product_id: order.product_id,
      });
      if (restoreErr) {
        console.error(`[stripe-webhook] restore_product_inventory (canceled) failed for product=${order.product_id}:`, restoreErr.message);
      }
    }

    console.log(`[stripe-webhook] payment_intent.canceled → order=${order.id} cancelled`);
    return json({ ok: true });
  }

  // ── All other events — acknowledge so Stripe stops retrying ───────────────
  console.log(`[stripe-webhook] ignored event type=${event.type}`);
  return json({ ok: true, ignored: true, reason: `Unhandled event type: ${event.type}` });
});
