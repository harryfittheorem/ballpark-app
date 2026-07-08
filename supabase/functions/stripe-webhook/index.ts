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

import { createClient } from 'npm:@supabase/supabase-js@2';

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

  const plainText = [
    `Hi ${opts.parentName},`,
    '',
    `We were unable to process your ${opts.planName} membership payment of ${amountStr}.`,
    '',
    'Please update your payment method to keep your membership active:',
    `Open the Ballpark app → Me → Payment Method`,
    '',
    `Or tap this link on your phone: ${appDeepLink}`,
    '',
    'Stripe will automatically retry the charge once your card is updated.',
    'If payment is not resolved within 7 days, your membership may be paused.',
    '',
    'Questions? Reply to this email or contact your facility directly.',
  ].join('\n');

  const body = {
    from: opts.resendFromEmail,
    to: opts.toEmail,
    subject: 'Action required: update your payment method',
    text: plainText,
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

// ─── Escalation email (failure #2) via Resend ────────────────────────────────

async function sendEscalationEmail(opts: {
  toEmail: string;
  parentName: string;
  planName: string;
  amountCents: number;
  resendApiKey: string;
  resendFromEmail: string;
}) {
  const amountStr = `$${(opts.amountCents / 100).toFixed(2)}`;
  const appDeepLink = 'ballpark://me/payment-method';

  const plainText = [
    `Hi ${opts.parentName},`,
    '',
    `This is your second failed payment for your ${opts.planName} membership (${amountStr}).`,
    '',
    'Please update your payment method within 7 days or your membership will be paused.',
    `Open the Ballpark app → Me → Payment Method`,
    '',
    `Or tap this link on your phone: ${appDeepLink}`,
    '',
    'Questions? Reply to this email or contact your facility directly.',
  ].join('\n');

  const body = {
    from: opts.resendFromEmail,
    to: opts.toEmail,
    subject: 'Second failed payment — update your card within 7 days',
    text: plainText,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #1a1a1a; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #d4a843; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 1px;">
            BALLPARK SPORTS
          </h1>
        </div>
        <div style="padding: 32px; background: #fff; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="font-size: 18px; margin-bottom: 12px; color: #c0392b;">
            Second failed payment — action needed
          </h2>
          <p>Hi ${opts.parentName},</p>
          <p>This is your <strong>second failed payment</strong> for your <strong>${opts.planName}</strong>
          membership (<strong>${amountStr}</strong>).</p>
          <p style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            ⚠️ Please update your payment method within <strong>7 days</strong> or your membership will be <strong>paused</strong>.
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
            If the button above doesn't open the app, go to <strong>Me → Payment Method</strong>.
            Stripe will automatically retry once your card is updated.
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
      console.error(`[stripe-webhook] Resend escalation email failed: ${res.status} ${errText}`);
    } else {
      console.log(`[stripe-webhook] Escalation email sent to ${opts.toEmail}`);
    }
  } catch (err) {
    console.error('[stripe-webhook] Resend escalation email exception:', err);
  }
}

// ─── Final-notice email (failure #3) via Resend ───────────────────────────────

async function sendFinalNoticeEmail(opts: {
  toEmail: string;
  parentName: string;
  planName: string;
  amountCents: number;
  resendApiKey: string;
  resendFromEmail: string;
}) {
  const amountStr = `$${(opts.amountCents / 100).toFixed(2)}`;
  const appDeepLink = 'ballpark://me/payment-method';

  const plainText = [
    `Hi ${opts.parentName},`,
    '',
    `This is your third failed payment for your ${opts.planName} membership (${amountStr}).`,
    '',
    'Your membership will be paused in 24 hours if payment is not resolved.',
    `Update now: Open the Ballpark app → Me → Payment Method`,
    '',
    `Or tap this link on your phone: ${appDeepLink}`,
    '',
    'Questions? Reply to this email or contact your facility directly.',
  ].join('\n');

  const body = {
    from: opts.resendFromEmail,
    to: opts.toEmail,
    subject: 'Final notice: membership will be paused in 24 hours',
    text: plainText,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #1a1a1a; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #d4a843; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 1px;">
            BALLPARK SPORTS
          </h1>
        </div>
        <div style="padding: 32px; background: #fff; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="font-size: 18px; margin-bottom: 12px; color: #c0392b;">
            Final notice — membership pausing in 24 hours
          </h2>
          <p>Hi ${opts.parentName},</p>
          <p>This is your <strong>third failed payment</strong> for your <strong>${opts.planName}</strong>
          membership (<strong>${amountStr}</strong>).</p>
          <p style="background: #fde8e8; border: 1px solid #e74c3c; border-radius: 6px; padding: 12px 16px; margin: 16px 0; color: #c0392b; font-weight: 600;">
            🚨 Your membership will be <strong>paused in 24 hours</strong> if payment is not resolved.
          </p>
          <p>Update your payment method now to keep your access uninterrupted:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${appDeepLink}"
               style="display: inline-block; background: #c0392b; color: #fff;
                      font-weight: 700; font-size: 15px; padding: 14px 28px;
                      border-radius: 8px; text-decoration: none; letter-spacing: 0.5px;">
              Update Payment Now →
            </a>
          </div>
          <p style="color: #666; font-size: 13px;">
            Once your card is updated, Stripe will retry automatically. If your membership is paused,
            it will reactivate as soon as payment succeeds.
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
      console.error(`[stripe-webhook] Resend final-notice email failed: ${res.status} ${errText}`);
    } else {
      console.log(`[stripe-webhook] Final-notice email sent to ${opts.toEmail}`);
    }
  } catch (err) {
    console.error('[stripe-webhook] Resend final-notice email exception:', err);
  }
}

// ─── Reactivation email (payment recovered) via Resend ───────────────────────

async function sendReactivationEmail(opts: {
  toEmail: string;
  parentName: string;
  planName: string;
  resendApiKey: string;
  resendFromEmail: string;
}) {
  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a1a1a; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #d4a843; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 1px;">
          BALLPARK SPORTS
        </h1>
      </div>
      <div style="padding: 32px; background: #fff; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="font-size: 18px; margin-bottom: 12px; color: #27ae60;">
          ✓ Membership reactivated
        </h2>
        <p>Hi ${opts.parentName},</p>
        <p>Great news — your <strong>${opts.planName}</strong> membership has been
        <strong style="color: #27ae60;">reactivated</strong>. Payment was received successfully
        and your membership is now active.</p>
        <p style="color: #666; font-size: 13px;">
          Your regular billing cycle resumes on your next billing date. Welcome back!
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px;">
          Questions? Reply to this email or contact your facility directly.
        </p>
      </div>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.resendFromEmail,
        to: opts.toEmail,
        subject: `Your ${opts.planName} has been reactivated`,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[stripe-webhook] Resend reactivation email failed: ${res.status} ${errText}`);
    } else {
      console.log(`[stripe-webhook] Reactivation email sent to ${opts.toEmail}`);
    }
  } catch (err) {
    console.error('[stripe-webhook] Resend reactivation email exception:', err);
  }
}

// ─── Stripe: remove pause_collection ────────────────────────────────────────

async function stripeRemovePause(
  subscriptionId: string,
  secretKey: string,
  stripeAccountId?: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': '2024-06-20',
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'POST',
    headers,
    body: 'pause_collection=',
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
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

  // ── invoice.payment_succeeded / invoice.paid ──────────────────────────────
  // Both events fire when a subscription invoice is successfully charged.
  // `invoice.payment_succeeded` is the older event name; `invoice.paid` is
  // the preferred name in current Stripe docs. We handle both so that the
  // payment_failed_at flag is cleared and the membership re-activates
  // regardless of which event is configured in the Stripe dashboard webhook.
  //
  // Insert a paid payment_events row (if not already present for this
  // invoice+status), ensure membership is active, update next_billing_at,
  // and clear payment_failed_at so in-app banners disappear.
  //
  // Idempotency: check (stripe_invoice_id, status='paid') before inserting.
  // This allows a prior failed row for the same invoice to coexist — the family
  // got their card declined (failed row), fixed it, and was then charged
  // successfully (paid row). Both rows are legitimate history.
  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.paid') {
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

    // Look up the membership by stripe_subscription_id (include all fields needed for
    // recovery so we don't need a second round-trip after the payment_events insert).
    const { data: mem, error: memErr } = await supabase
      .from('memberships')
      .select('id, tenant_id, family_id, plan_name, status, payment_failure_count, payment_paused_reason, stripe_subscription_id, families!inner(primary_location_id)')
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

    // If a paid row already exists, skip the INSERT but still run full recovery —
    // the original delivery may have inserted the row then died before completing DB/Stripe updates.
    if (!existingPaid) {
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
    } else {
      console.log(`[stripe-webhook] invoice.payment_succeeded: paid row already exists invoice=${invoice.id} — running full recovery`);
    }

    // ── Full recovery — runs for both fresh and re-delivered paid events ──────
    // mem now includes all fields needed; no second round-trip required.
    const nextBillingAt = invoice.period_end
      ? new Date(invoice.period_end * 1000).toISOString()
      : null;

    const wasPaymentPaused =
      mem.status === 'paused' &&
      (mem as unknown as { payment_paused_reason: string | null }).payment_paused_reason === 'payment_overdue';

    const previousFailureCount =
      (mem as unknown as { payment_failure_count: number }).payment_failure_count ?? 0;

    // If membership was paused due to payment overdue, remove Stripe pause_collection
    if (wasPaymentPaused && mem.stripe_subscription_id) {
      try {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (stripeKey) {
          const famSucc2 = mem.families as unknown as { primary_location_id: string };
          const { data: locSucc2 } = await supabase
            .from('locations')
            .select('stripe_account_id')
            .eq('id', famSucc2.primary_location_id)
            .maybeSingle();
          await stripeRemovePause(
            mem.stripe_subscription_id as string,
            stripeKey,
            (locSucc2?.stripe_account_id as string | null) ?? undefined,
          );
          console.log(`[stripe-webhook] invoice.payment_succeeded: removed Stripe pause for membership=${mem.id}`);
        }
      } catch (stripeErr) {
        console.error(`[stripe-webhook] invoice.payment_succeeded: failed to remove Stripe pause for membership=${mem.id}:`, stripeErr);
      }
    }

    const recoveryUpdate: Record<string, unknown> = {
      status: 'active',
      payment_failed_at: null,
      payment_failure_count: 0,
      payment_pause_scheduled_at: null,
      next_billing_at: nextBillingAt,
      updated_at: new Date().toISOString(),
    };
    if (wasPaymentPaused) {
      recoveryUpdate.payment_paused_reason = null;
      recoveryUpdate.pause_start = null;
      recoveryUpdate.pause_end = null;
      recoveryUpdate.paused_at = null;
    }

    await supabase
      .from('memberships')
      .update(recoveryUpdate)
      .eq('id', mem.id);

    // ── One-time billing date revert (Task #553) ────────────────────────────
    // If a staff member made a one-time billing date shift (change_type='one_time'),
    // we deferred the next invoice via trial_end to the target day. Now that the
    // invoice has been paid, revert billing_cycle_anchor back to the original
    // anchor day so future charges fall on the original schedule.
    try {
      const { data: pendingChange } = await supabase
        .from('membership_billing_date_changes')
        .select('id, old_anchor_day')
        .eq('membership_id', mem.id)
        .eq('change_type', 'one_time')
        .is('reverted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingChange) {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        const famRevert = mem.families as unknown as { primary_location_id: string };
        const { data: locRevert } = await supabase
          .from('locations')
          .select('stripe_account_id')
          .eq('id', famRevert.primary_location_id)
          .maybeSingle();

        // stripe_subscription_id is now on mem directly (no second fetch needed)
        const subId = mem.stripe_subscription_id as string | null;

        if (stripeKey && locRevert?.stripe_account_id && subId) {
          const oldDay = pendingChange.old_anchor_day as number;
          const now = new Date();
          const revertDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), oldDay));
          if (revertDate.getTime() <= now.getTime()) {
            revertDate.setUTCMonth(revertDate.getUTCMonth() + 1);
          }
          const revertTs = Math.floor(revertDate.getTime() / 1000);

          const enc = (k: string, v: string | number) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;

          const revertRes = await fetch(
            `https://api.stripe.com/v1/subscriptions/${subId}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Stripe-Version': '2024-06-20',
                'Stripe-Account': locRevert.stripe_account_id as string,
              },
              body: [
                enc('billing_cycle_anchor', revertTs),
                enc('proration_behavior', 'none'),
              ].join('&'),
            },
          );

          if (!revertRes.ok) {
            const errBody = await revertRes.json().catch(() => ({})) as { error?: { message?: string } };
            console.error(
              `[stripe-webhook] one-time revert Stripe call failed (${revertRes.status}): ${errBody.error?.message ?? 'unknown error'} — membership=${mem.id}`,
            );
          } else {
            await supabase
              .from('memberships')
              .update({
                billing_anchor_day: oldDay,
                updated_at: new Date().toISOString(),
              })
              .eq('id', mem.id);

            await supabase
              .from('membership_billing_date_changes')
              .update({ reverted_at: new Date().toISOString() })
              .eq('id', pendingChange.id);

            console.log(`[stripe-webhook] one-time billing date reverted: membership=${mem.id} anchor_day=${oldDay}`);
          }
        }
      }
    } catch (revertErr) {
      console.error('[stripe-webhook] one-time revert error (non-fatal):', revertErr);
    }

    // ── Reactivation notification (Task #554) ────────────────────────────────
    // Send email + push if membership previously had payment failures.
    if (previousFailureCount > 0) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
      const { data: famReact } = await supabase
        .from('families')
        .select('parent_first_name, parent_email, parent_user_id')
        .eq('id', mem.family_id)
        .maybeSingle();

      const reactPromises: Promise<unknown>[] = [];
      if (resendApiKey && resendFromEmail && famReact?.parent_email) {
        reactPromises.push(
          sendReactivationEmail({
            toEmail: famReact.parent_email,
            parentName: famReact.parent_first_name ?? 'there',
            planName: (mem as unknown as { plan_name: string }).plan_name,
            resendApiKey,
            resendFromEmail,
          }).catch(err => console.error('[stripe-webhook] sendReactivationEmail error:', err)),
        );
      }
      if (famReact?.parent_user_id) {
        reactPromises.push(
          fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              user_ids: [famReact.parent_user_id],
              title: '✓ Membership Reactivated',
              body: `Your ${(mem as unknown as { plan_name: string }).plan_name} is now active. Payment received — welcome back!`,
              data: { kind: 'membership_reactivated', membership_id: mem.id },
            }),
          }).catch(err => console.error('[stripe-webhook] reactivation push error:', err)),
        );
      }
      await Promise.allSettled(reactPromises);
    }

    console.log(`[stripe-webhook] invoice.payment_succeeded → membership=${mem.id} invoice=${invoice.id} amount=${invoice.amount_paid} was_paused=${wasPaymentPaused} prev_failures=${previousFailureCount}`);
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
      .select('id, tenant_id, family_id, plan_name, status, payment_failure_count, payment_pause_scheduled_at, families!inner(primary_location_id)')
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

    const now = new Date().toISOString();

    if (!existingAttempt) {
      // ── New attempt: insert payment_events row, increment counter, fan-out ──

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
          created_at: now,
        });

      if (insertErr) {
        console.error('[stripe-webhook] invoice.payment_failed insert error:', insertErr.message);
        return json({ error: { code: 'db_error', message: insertErr.message } }, 500);
      }

      const currentCount = (mem.payment_failure_count as number) ?? 0;
      const newCount = currentCount + 1;

      // Set payment_pause_scheduled_at ONLY on the first time we reach 3+
      // (i.e. it is currently null). Prevents re-extending the 24h window on
      // subsequent distinct failures (#4, #5) if pause was already scheduled.
      const currentPauseScheduled = (mem as unknown as { payment_pause_scheduled_at: string | null }).payment_pause_scheduled_at;
      const membershipUpdate: Record<string, unknown> = {
        status: 'payment_overdue',
        payment_failed_at: now,
        payment_failure_count: newCount,
        updated_at: now,
      };
      if (newCount >= 3 && !currentPauseScheduled) {
        membershipUpdate.payment_pause_scheduled_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      await supabase
        .from('memberships')
        .update(membershipUpdate)
        .eq('id', mem.id)
        .in('status', ['active', 'payment_overdue']);

      // Fan-out: push + email — best-effort via Promise.allSettled, never fail the webhook
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');

      const { data: family } = await supabase
        .from('families')
        .select('parent_first_name, parent_email, parent_user_id')
        .eq('id', mem.family_id)
        .single();

      const fanOutPromises: Promise<unknown>[] = [];

      if (family?.parent_user_id) {
        fanOutPromises.push(
          fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              user_ids: [family.parent_user_id],
              title: 'Payment failed',
              body: newCount >= 3
                ? 'Third failed payment — your membership will be paused in 24 hours.'
                : newCount === 2
                  ? 'Second failed payment — update your card within 7 days.'
                  : 'Your autopay failed — tap to update your card.',
              data: { kind: 'payment_failed', screen: 'PaymentMethod' },
            }),
          }).catch(err => console.error('[stripe-webhook] push fan-out error:', err)),
        );
      }

      if (resendApiKey && resendFromEmail && family?.parent_email) {
        const emailOpts = {
          toEmail: family.parent_email,
          parentName: family.parent_first_name ?? 'there',
          planName: mem.plan_name,
          amountCents: invoice.amount_due,
          resendApiKey,
          resendFromEmail,
        };
        if (newCount === 1) {
          fanOutPromises.push(
            sendDunningEmail(emailOpts)
              .catch(err => console.error('[stripe-webhook] sendDunningEmail error:', err)),
          );
        } else if (newCount === 2) {
          fanOutPromises.push(
            sendEscalationEmail(emailOpts)
              .catch(err => console.error('[stripe-webhook] sendEscalationEmail error:', err)),
          );
        } else if (newCount === 3) {
          fanOutPromises.push(
            sendFinalNoticeEmail(emailOpts)
              .catch(err => console.error('[stripe-webhook] sendFinalNoticeEmail error:', err)),
          );
        }
        // newCount > 3: already sent final notice; no additional email
      }

      await Promise.allSettled(fanOutPromises);
      console.log(`[stripe-webhook] invoice.payment_failed → membership=${mem.id} invoice=${invoice.id} attempt=${invoice.attempt_count} failure_count=${newCount}`);
    } else {
      // ── Re-delivery of same attempt: idempotent status update only ────────
      // Do NOT increment failure_count or re-send notifications.
      await supabase
        .from('memberships')
        .update({ status: 'payment_overdue', payment_failed_at: now, updated_at: now })
        .eq('id', mem.id)
        .in('status', ['active', 'payment_overdue']);
      console.log(`[stripe-webhook] invoice.payment_failed: duplicate delivery invoice=${invoice.id} attempt=${attemptCode} — status updated, count not incremented`);
    }

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

  // ── customer.subscription.updated ─────────────────────────────────────────
  // Fired whenever a subscription is modified (billing anchor change, trial end,
  // plan change, etc.). We sync next_billing_at so the mobile app reflects the
  // correct next charge date immediately after a billing date change.
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as {
      id: string;
      current_period_end?: number;
      status?: string;
    };

    const { data: memUpdated } = await supabase
      .from('memberships')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();

    if (memUpdated && sub.current_period_end) {
      await supabase
        .from('memberships')
        .update({
          next_billing_at: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', memUpdated.id);
      console.log(`[stripe-webhook] subscription.updated → synced next_billing_at membership=${memUpdated.id}`);
    }

    return json({ ok: true });
  }

  // ── All other events — acknowledge so Stripe stops retrying ───────────────
  console.log(`[stripe-webhook] ignored event type=${event.type}`);
  return json({ ok: true, ignored: true, reason: `Unhandled event type: ${event.type}` });
});
