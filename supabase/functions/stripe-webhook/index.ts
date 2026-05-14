// =============================================================================
// supabase/functions/stripe-webhook/index.ts
// =============================================================================
// Task #188 — Stripe Connect Phase 1
// Task #72  — Stripe Connect Phase 2 (payment_intent fulfillment)
// Task #189 — Stripe Connect Phase 3 (subscription lifecycle)
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
//   RESEND_API_KEY         (for dunning emails on invoice.payment_failed)
//   RESEND_FROM_EMAIL      (from address for dunning emails)
//   SUPABASE_URL           (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//
// Handled events:
//   account.updated                   → sync stripe_onboarding_status on locations
//   payment_intent.succeeded          → mark order 'ordered' + record amount_paid_cents
//   payment_intent.payment_failed     → mark order payment_failed + log reason
//   payment_intent.canceled           → mark order 'cancelled' (user dismissed sheet)
//   customer.subscription.created     → set membership active + next_billing_at
//   invoice.payment_succeeded         → insert paid payment_events, mark membership active
//   invoice.payment_failed            → insert failed payment_events, set payment_overdue,
//                                       send Resend dunning email with app deep link
//   customer.subscription.deleted     → mark membership cancelled
//
// Idempotency model for invoice events:
//   payment_events.stripe_invoice_id is a non-unique index.
//   Before each insert we check for an existing row with the SAME
//   (stripe_invoice_id, status). This allows:
//     - Multiple failed rows for different retry attempts (different attempt_count)
//     - A paid row for a recovered invoice that previously had a failed row
//   The unique-per-attempt constraint is enforced by checking both invoice_id and
//   the error_code (which encodes the attempt number for failed events).
//
// All unrecognised events → 200 {ignored:true} so Stripe stops retrying.
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

// ─── Dunning email via Resend ─────────────────────────────────────────────────

async function sendDunningEmail(opts: {
  toEmail: string;
  parentName: string;
  planName: string;
  amountCents: number;
  resendApiKey: string;
  resendFromEmail: string;
}) {
  const amountStr = `$${(opts.amountCents / 100).toFixed(2)}`;
  // Deep link opens the Payment Method screen directly in the Ballpark app
  const appDeepLink = 'ballpark://me/payment-method';

  const body = {
    from: opts.resendFromEmail,
    to: opts.toEmail,
    subject: `Action needed: Payment of ${amountStr} failed for ${opts.planName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #1a1a1a; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #d4a843; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 1px;">
            BALLPARK SPORTS
          </h1>
        </div>
        <div style="padding: 32px; background: #fff; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="font-size: 18px; margin-bottom: 12px; color: #c0392b;">
            Payment failed — action needed
          </h2>
          <p>Hi ${opts.parentName},</p>
          <p>We were unable to process your <strong>${opts.planName}</strong> membership payment of
          <strong>${amountStr}</strong>.</p>
          <p style="margin: 20px 0;">
            <strong>Fix it in 30 seconds:</strong> Tap the button below to open the Ballpark app
            and update your payment card in <strong>Me → Payment Method</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${appDeepLink}"
               style="display: inline-block; background: #d4a843; color: #1a1a1a;
                      font-weight: 700; font-size: 15px; padding: 14px 28px;
                      border-radius: 8px; text-decoration: none; letter-spacing: 0.5px;">
              Update Payment Method →
            </a>
          </div>
          <p style="color: #666; font-size: 13px;">
            If the button above doesn't open the app, open Ballpark and go to
            <strong>Me → Payment Method</strong> to add a new card. Stripe will automatically
            retry the charge. If payment is not resolved within 7 days, your membership
            may be paused.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">
            Questions? Reply to this email or contact your facility directly.
          </p>
        </div>
      </div>
    `,
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[stripe-webhook] Resend dunning email failed: ${res.status} ${errText}`);
    } else {
      console.log(`[stripe-webhook] Dunning email sent to ${opts.toEmail}`);
    }
  } catch (err) {
    console.error('[stripe-webhook] Resend dunning email exception:', err);
  }
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

  let event: { type: string; account?: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: { code: 'bad_json', message: 'Could not parse event body' } }, 400);
  }

  // The connected account that generated this event (set by Stripe on Connect webhooks).
  // Used to verify that subscription lifecycle events actually came from the same
  // Stripe account as the membership's location — preventing cross-tenant webhook injection.
  const eventAccount = event.account ?? null;

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
      console.log(`[stripe-webhook] payment_intent.succeeded: no order for pi=${pi.id}, ignoring`);
      return json({ ok: true, ignored: true, reason: 'No order found for this PaymentIntent' });
    }

    if (order.status === 'ordered' || order.status === 'fulfilled') {
      console.log(`[stripe-webhook] payment_intent.succeeded: order=${order.id} already ${order.status}`);
      return json({ ok: true });
    }

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
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .in('status', allowedFromStatuses)
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('[stripe-webhook] payment_intent.succeeded update error:', updateErr.message);
      return json({ error: { code: 'db_error', message: updateErr.message } }, 500);
    }

    if (!updated) {
      console.log(`[stripe-webhook] payment_intent.succeeded: order=${order.id} already transitioned by concurrent delivery`);
      return json({ ok: true });
    }

    console.log(`[stripe-webhook] payment_intent.succeeded → order=${order.id} ordered amount=${amountCents}`);
    return json({ ok: true });
  }

  // ── payment_intent.payment_failed ─────────────────────────────────────────
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
      return json({ ok: true });
    }

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
      .eq('status', 'payment_pending')
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('[stripe-webhook] payment_intent.payment_failed update error:', updateErr.message);
      return json({ error: { code: 'db_error', message: updateErr.message } }, 500);
    }

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
      .eq('status', 'payment_pending')
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('[stripe-webhook] payment_intent.canceled update error:', updateErr.message);
      return json({ error: { code: 'db_error', message: updateErr.message } }, 500);
    }

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

  // ── customer.subscription.created ────────────────────────────────────────
  // Fires when a subscription is first activated (including when created via
  // our stripe-create-subscription edge function). Marks the membership active
  // and records the first billing cycle end as next_billing_at.
  if (event.type === 'customer.subscription.created') {
    const sub = event.data.object as {
      id: string;
      status: string;
      customer: string;
      current_period_end?: number;
      metadata?: Record<string, string>;
    };

    const membershipId = sub.metadata?.membership_id;
    if (!membershipId) {
      console.log(`[stripe-webhook] subscription.created: no membership_id in metadata, ignoring sub=${sub.id}`);
      return json({ ok: true, ignored: true, reason: 'No membership_id in subscription metadata' });
    }

    // Fetch the membership + location to verify the event account matches.
    // This prevents a malicious/compromised connected account from injecting events
    // with a different tenant's membership_id in the subscription metadata.
    const { data: memForVerify } = await supabase
      .from('memberships')
      .select('id, families!inner(primary_location_id)')
      .eq('id', membershipId)
      .maybeSingle();

    if (memForVerify && eventAccount) {
      const famVerify = memForVerify.families as unknown as { primary_location_id: string };
      const { data: locVerify } = await supabase
        .from('locations')
        .select('stripe_account_id')
        .eq('id', famVerify.primary_location_id)
        .maybeSingle();
      if (locVerify?.stripe_account_id && locVerify.stripe_account_id !== eventAccount) {
        console.warn(`[stripe-webhook] subscription.created SECURITY: event account ${eventAccount} ≠ location ${locVerify.stripe_account_id} for membership=${membershipId} — rejecting`);
        return json({ ok: true, ignored: true, reason: 'Connected account mismatch' });
      }
    }

    const nextBillingAt = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    // Map Stripe subscription status → DB membership status.
    // Do not force 'active' unconditionally: Stripe may return incomplete/past_due
    // on the created event if the first invoice requires authentication or fails.
    // The invoice.payment_succeeded / invoice.payment_failed events will reconcile
    // further, but we start with an accurate status from Stripe.
    let subDbStatus: string;
    if (sub.status === 'active' || sub.status === 'trialing') {
      subDbStatus = 'active';
    } else if (sub.status === 'incomplete' || sub.status === 'past_due' || sub.status === 'unpaid') {
      subDbStatus = 'payment_overdue';
    } else {
      subDbStatus = 'payment_overdue';
    }

    const { error: updErr } = await supabase
      .from('memberships')
      .update({
        stripe_subscription_id: sub.id,
        status: subDbStatus,
        next_billing_at: nextBillingAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId);

    if (updErr) {
      console.error('[stripe-webhook] subscription.created update error:', updErr.message);
      return json({ error: { code: 'db_error', message: updErr.message } }, 500);
    }

    console.log(`[stripe-webhook] subscription.created → membership=${membershipId} sub=${sub.id} stripe_status=${sub.status} db_status=${subDbStatus}`);
    return json({ ok: true });
  }

  // ── invoice.payment_succeeded ─────────────────────────────────────────────
  // A subscription renewal was successfully charged. Insert a paid payment_events
  // row (if not already present for this invoice+status), ensure membership is
  // active, and update next_billing_at.
  //
  // Idempotency: check (stripe_invoice_id, status='paid') before inserting.
  // This allows a prior failed row for the same invoice to coexist — the family
  // got their card declined (failed row), fixed it, and was then charged
  // successfully (paid row). Both rows are legitimate history.
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as {
      id: string;
      subscription?: string;
      customer: string;
      amount_paid: number;
      currency: string;
      period_end?: number;
    };

    // Only care about subscription invoices
    if (!invoice.subscription) {
      console.log(`[stripe-webhook] invoice.payment_succeeded: no subscription, ignoring`);
      return json({ ok: true, ignored: true });
    }

    // Look up the membership by stripe_subscription_id (include location for account verification)
    const { data: mem, error: memErr } = await supabase
      .from('memberships')
      .select('id, tenant_id, family_id, status, families!inner(primary_location_id)')
      .eq('stripe_subscription_id', invoice.subscription)
      .maybeSingle();

    if (memErr) {
      console.error('[stripe-webhook] invoice.payment_succeeded mem lookup error:', memErr.message);
      return json({ error: { code: 'db_error', message: memErr.message } }, 500);
    }

    if (!mem) {
      console.log(`[stripe-webhook] invoice.payment_succeeded: no membership for sub=${invoice.subscription}, ignoring`);
      return json({ ok: true, ignored: true });
    }

    // Verify the event's connected account matches the membership's location's Stripe account.
    if (eventAccount) {
      const famSucc = mem.families as unknown as { primary_location_id: string };
      const { data: locSucc } = await supabase
        .from('locations')
        .select('stripe_account_id')
        .eq('id', famSucc.primary_location_id)
        .maybeSingle();
      if (locSucc?.stripe_account_id && locSucc.stripe_account_id !== eventAccount) {
        console.warn(`[stripe-webhook] invoice.payment_succeeded SECURITY: event account ${eventAccount} ≠ location ${locSucc.stripe_account_id} membership=${mem.id} — rejecting`);
        return json({ ok: true, ignored: true, reason: 'Connected account mismatch' });
      }
    }

    // Idempotency: check for an existing PAID row for this invoice.
    // We specifically check status='paid' to allow a prior failed row
    // to coexist (payment retry scenario).
    const { data: existingPaid } = await supabase
      .from('payment_events')
      .select('id')
      .eq('stripe_invoice_id', invoice.id)
      .eq('status', 'paid')
      .maybeSingle();

    if (existingPaid) {
      console.log(`[stripe-webhook] invoice.payment_succeeded: paid row already exists invoice=${invoice.id}`);
      // Still update membership status + next_billing_at in case a prior webhook fired early
      await supabase
        .from('memberships')
        .update({
          status: 'active',
          next_billing_at: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mem.id);
      return json({ ok: true });
    }

    // Insert paid payment_events row
    const nextBillingAt = invoice.period_end
      ? new Date(invoice.period_end * 1000).toISOString()
      : null;

    const { error: insertErr } = await supabase
      .from('payment_events')
      .insert({
        tenant_id: mem.tenant_id,
        family_id: mem.family_id,
        membership_id: mem.id,
        amount_cents: invoice.amount_paid,
        status: 'paid',
        payment_method: 'card',
        stripe_invoice_id: invoice.id,
        created_at: new Date().toISOString(),
      });

    if (insertErr) {
      console.error('[stripe-webhook] invoice.payment_succeeded insert error:', insertErr.message);
      return json({ error: { code: 'db_error', message: insertErr.message } }, 500);
    }

    // Ensure membership is active (recovers from payment_overdue) + update next_billing_at
    await supabase
      .from('memberships')
      .update({
        status: 'active',
        next_billing_at: nextBillingAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mem.id);

    console.log(`[stripe-webhook] invoice.payment_succeeded → membership=${mem.id} invoice=${invoice.id} amount=${invoice.amount_paid}`);
    return json({ ok: true });
  }

  // ── invoice.payment_failed ────────────────────────────────────────────────
  // A subscription renewal charge failed. Insert a failed payment_events row
  // (idempotent per attempt via stripe_invoice_id + error_code), set membership
  // to payment_overdue, and send a Resend dunning email with a deep link.
  //
  // Idempotency per attempt: each Stripe retry has a unique attempt_count.
  // We store attempt_N in error_code and check (stripe_invoice_id + error_code)
  // before inserting, so the same retry attempt is never double-counted but
  // different retry attempts all get their own row.
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as {
      id: string;
      subscription?: string;
      customer: string;
      amount_due: number;
      currency: string;
      attempt_count?: number;
      next_payment_attempt?: number | null;
    };

    if (!invoice.subscription) {
      console.log(`[stripe-webhook] invoice.payment_failed: no subscription, ignoring`);
      return json({ ok: true, ignored: true });
    }

    const attemptCode = `attempt_${invoice.attempt_count ?? 1}`;

    // Look up the membership (include location for account verification)
    const { data: mem, error: memErr } = await supabase
      .from('memberships')
      .select('id, tenant_id, family_id, plan_name, status, families!inner(primary_location_id)')
      .eq('stripe_subscription_id', invoice.subscription)
      .maybeSingle();

    if (memErr) {
      console.error('[stripe-webhook] invoice.payment_failed mem lookup error:', memErr.message);
      return json({ error: { code: 'db_error', message: memErr.message } }, 500);
    }

    if (!mem) {
      console.log(`[stripe-webhook] invoice.payment_failed: no membership for sub=${invoice.subscription}, ignoring`);
      return json({ ok: true, ignored: true });
    }

    // Verify the event's connected account matches the membership's location's Stripe account.
    if (eventAccount) {
      const famFail = mem.families as unknown as { primary_location_id: string };
      const { data: locFail } = await supabase
        .from('locations')
        .select('stripe_account_id')
        .eq('id', famFail.primary_location_id)
        .maybeSingle();
      if (locFail?.stripe_account_id && locFail.stripe_account_id !== eventAccount) {
        console.warn(`[stripe-webhook] invoice.payment_failed SECURITY: event account ${eventAccount} ≠ location ${locFail.stripe_account_id} membership=${mem.id} — rejecting`);
        return json({ ok: true, ignored: true, reason: 'Connected account mismatch' });
      }
    }

    // Idempotency: check for existing row with SAME (stripe_invoice_id, error_code/attempt).
    // Different attempts produce different error_codes, so retries each get their own row.
    const { data: existingAttempt } = await supabase
      .from('payment_events')
      .select('id')
      .eq('stripe_invoice_id', invoice.id)
      .eq('error_code', attemptCode)
      .maybeSingle();

    if (!existingAttempt) {
      const { error: insertErr } = await supabase
        .from('payment_events')
        .insert({
          tenant_id: mem.tenant_id,
          family_id: mem.family_id,
          membership_id: mem.id,
          amount_cents: invoice.amount_due,
          status: 'failed',
          payment_method: 'card',
          stripe_invoice_id: invoice.id,
          error_code: attemptCode,
          created_at: new Date().toISOString(),
        });

      if (insertErr) {
        console.error('[stripe-webhook] invoice.payment_failed insert error:', insertErr.message);
        return json({ error: { code: 'db_error', message: insertErr.message } }, 500);
      }
    }

    // Mark membership as payment_overdue (only if currently active — don't overwrite cancelled)
    await supabase
      .from('memberships')
      .update({
        status: 'payment_overdue',
        updated_at: new Date().toISOString(),
      })
      .eq('id', mem.id)
      .eq('status', 'active');

    // Send dunning email — best effort via Promise.allSettled pattern, never fail the webhook
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');

    if (resendApiKey && resendFromEmail) {
      const { data: family } = await supabase
        .from('families')
        .select('parent_first_name, parent_email')
        .eq('id', mem.family_id)
        .single();

      if (family?.parent_email) {
        const parentName = family.parent_first_name ?? 'there';
        // Fire-and-forget; webhook must succeed regardless of email outcome
        sendDunningEmail({
          toEmail: family.parent_email,
          parentName,
          planName: mem.plan_name,
          amountCents: invoice.amount_due,
          resendApiKey,
          resendFromEmail,
        }).catch(err => console.error('[stripe-webhook] sendDunningEmail unexpected error:', err));
      }
    }

    console.log(`[stripe-webhook] invoice.payment_failed → membership=${mem.id} invoice=${invoice.id} attempt=${invoice.attempt_count}`);
    return json({ ok: true });
  }

  // ── customer.subscription.deleted ─────────────────────────────────────────
  // Stripe has finalised the cancellation (either at period end after our
  // cancel_at_period_end request, or immediately after exhausting dunning
  // retries). Mark the membership as cancelled.
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as {
      id: string;
      customer: string;
      metadata?: Record<string, string>;
    };

    const { data: mem, error: memErr } = await supabase
      .from('memberships')
      .select('id, status, families!inner(primary_location_id)')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();

    if (memErr) {
      console.error('[stripe-webhook] subscription.deleted lookup error:', memErr.message);
      return json({ error: { code: 'db_error', message: memErr.message } }, 500);
    }

    if (!mem) {
      console.log(`[stripe-webhook] subscription.deleted: no membership for sub=${sub.id}, ignoring`);
      return json({ ok: true, ignored: true });
    }

    // Verify the event's connected account matches the membership's location's Stripe account.
    if (eventAccount) {
      const famDel = mem.families as unknown as { primary_location_id: string };
      const { data: locDel } = await supabase
        .from('locations')
        .select('stripe_account_id')
        .eq('id', famDel.primary_location_id)
        .maybeSingle();
      if (locDel?.stripe_account_id && locDel.stripe_account_id !== eventAccount) {
        console.warn(`[stripe-webhook] subscription.deleted SECURITY: event account ${eventAccount} ≠ location ${locDel.stripe_account_id} membership=${mem.id} — rejecting`);
        return json({ ok: true, ignored: true, reason: 'Connected account mismatch' });
      }
    }

    if (mem.status === 'cancelled') {
      return json({ ok: true });
    }

    await supabase
      .from('memberships')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mem.id);

    console.log(`[stripe-webhook] subscription.deleted → membership=${mem.id} cancelled`);
    return json({ ok: true });
  }

  // ── All other events — acknowledge so Stripe stops retrying ───────────────
  console.log(`[stripe-webhook] ignored event type=${event.type}`);
  return json({ ok: true, ignored: true, reason: `Unhandled event type: ${event.type}` });
});
