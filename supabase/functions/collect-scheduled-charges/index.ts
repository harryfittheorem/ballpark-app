// =============================================================================
// supabase/functions/collect-scheduled-charges/index.ts
// =============================================================================
// Collects pending scheduled charges whose charge_date is today or earlier.
// Called daily at 07:00 UTC via pg_cron.
//
// Also sends 2-day-ahead reminder emails for charges due in 2 days.
//
// Deploy with:
//   npx supabase functions deploy collect-scheduled-charges
//
// Register pg_cron job (run once after deploy):
//   SELECT cron.schedule(
//     'collect-scheduled-charges',
//     '0 7 * * *',
//     $$
//       SELECT net.http_post(
//         url := current_setting('app.settings.supabase_url') || '/functions/v1/collect-scheduled-charges',
//         headers := jsonb_build_object(
//           'Content-Type', 'application/json',
//           'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
//         ),
//         body := '{}'::jsonb
//       );
//     $$
//   );
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL
//   SUPABASE_URL           (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY (auto-injected)
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_VERSION = '2024-06-20';
const RESEND_API = 'https://api.resend.com/emails';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  resendKey: string;
  resendFrom: string;
}) {
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.resendFrom,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[collect-scheduled-charges] Email failed ${res.status}: ${t}`);
    }
  } catch (e) {
    console.error('[collect-scheduled-charges] Email exception:', e);
  }
}

function receiptEmailHtml(opts: {
  parentName: string;
  amountCents: number;
  planName: string;
  chargeDate: string;
}) {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  return `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#1C1B1A;color:#FAF6E8;border-radius:10px;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:900;letter-spacing:3px;color:#F1E5AD;font-family:Oswald,Impact,sans-serif;">BALLPARK</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;color:#F1E5AD;margin:0 0 8px;">Payment received — ${amount}</h1>
      <p style="color:#B0ABA8;margin:0 0 20px;">Hi ${opts.parentName}, your balance payment for <strong style="color:#FAF6E8;">${opts.planName}</strong> has been collected successfully.</p>
      <div style="background:#2D2B2A;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="margin-bottom:8px;">
          <span style="color:#A8A3A0;font-size:12px;">AMOUNT</span><br/>
          <strong style="font-size:18px;">${amount}</strong>
        </div>
        <div>
          <span style="color:#A8A3A0;font-size:12px;">DATE</span><br/>
          <strong style="font-size:15px;">${opts.chargeDate}</strong>
        </div>
      </div>
      <p style="color:#A8A3A0;font-size:11px;margin:24px 0 0;text-align:center;">Infinite Hitting Baseball Academy</p>
    </div>
  `;
}

function reminderEmailHtml(opts: {
  parentName: string;
  amountCents: number;
  planName: string;
  chargeDate: string;
}) {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  return `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#1C1B1A;color:#FAF6E8;border-radius:10px;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:900;letter-spacing:3px;color:#F1E5AD;font-family:Oswald,Impact,sans-serif;">BALLPARK</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;color:#F1E5AD;margin:0 0 8px;">Balance payment due in 2 days</h1>
      <p style="color:#B0ABA8;margin:0 0 20px;">Hi ${opts.parentName}, a reminder that your balance payment for <strong style="color:#FAF6E8;">${opts.planName}</strong> will be collected in 2 days.</p>
      <div style="background:#2D2B2A;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="margin-bottom:8px;">
          <span style="color:#A8A3A0;font-size:12px;">AMOUNT DUE</span><br/>
          <strong style="font-size:18px;">${amount}</strong>
        </div>
        <div>
          <span style="color:#A8A3A0;font-size:12px;">CHARGE DATE</span><br/>
          <strong style="font-size:15px;">${opts.chargeDate}</strong>
        </div>
      </div>
      <p style="color:#B0ABA8;font-size:13px;">Please ensure your payment card on file is up to date. Open the Ballpark app → Me → Payment Method to update your card.</p>
      <p style="color:#A8A3A0;font-size:11px;margin:24px 0 0;text-align:center;">Infinite Hitting Baseball Academy</p>
    </div>
  `;
}

function failedEmailHtml(opts: {
  parentName: string;
  amountCents: number;
  planName: string;
  failureReason: string;
}) {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  return `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#1C1B1A;color:#FAF6E8;border-radius:10px;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:900;letter-spacing:3px;color:#F1E5AD;font-family:Oswald,Impact,sans-serif;">BALLPARK</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;color:#e74c3c;margin:0 0 8px;">Balance payment failed</h1>
      <p style="color:#B0ABA8;margin:0 0 20px;">Hi ${opts.parentName}, we were unable to collect your balance payment of <strong style="color:#FAF6E8;">${amount}</strong> for <strong style="color:#FAF6E8;">${opts.planName}</strong>.</p>
      <div style="background:#2D1A1A;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid #e74c3c44;">
        <span style="color:#A8A3A0;font-size:12px;">REASON</span><br/>
        <strong style="font-size:14px;color:#e74c3c;">${opts.failureReason}</strong>
      </div>
      <p style="color:#B0ABA8;font-size:13px;">Please update your payment method in the Ballpark app (Me → Payment Method) and contact us to reschedule your balance payment.</p>
      <p style="color:#A8A3A0;font-size:11px;margin:24px 0 0;text-align:center;">Infinite Hitting Baseball Academy</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  // ── Service-role Authorization gate ───────────────────────────────────────
  // This function is intended to be called ONLY by pg_cron via the service
  // role key. Reject any caller that doesn't present a matching Bearer token.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@infinitehitting.com';

  if (!stripeKey) {
    console.error('[collect-scheduled-charges] STRIPE_SECRET_KEY not set');
    return json({ error: 'Stripe not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const twoDaysOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── 1. Send 2-day reminders ────────────────────────────────────────────────
  if (resendKey) {
    const { data: upcoming } = await supabase
      .from('scheduled_charges')
      .select(`
        id, amount_cents, charge_date, membership_id,
        families!inner(parent_email, parent_first_name, parent_last_name),
        memberships!inner(plan_name)
      `)
      .eq('status', 'pending')
      .eq('charge_date', twoDaysOut);

    for (const charge of upcoming ?? []) {
      const fam = charge.families as unknown as {
        parent_email: string;
        parent_first_name: string;
        parent_last_name: string | null;
      };
      const mem = charge.memberships as unknown as { plan_name: string };
      const parentName = [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' ');

      await sendEmail({
        to: fam.parent_email,
        subject: `Reminder: $${(charge.amount_cents / 100).toFixed(2)} balance payment due in 2 days`,
        html: reminderEmailHtml({
          parentName,
          amountCents: charge.amount_cents,
          planName: mem.plan_name,
          chargeDate: charge.charge_date,
        }),
        resendKey,
        resendFrom,
      });
    }
  }

  // ── 2. Collect due charges ─────────────────────────────────────────────────
  const { data: dueCharges, error: fetchErr } = await supabase
    .from('scheduled_charges')
    .select(`
      id, amount_cents, charge_date, membership_id, family_id, tenant_id,
      families!inner(parent_email, parent_first_name, parent_last_name, stripe_connected_customer_id, primary_location_id),
      memberships!inner(plan_name)
    `)
    .eq('status', 'pending')
    .lte('charge_date', today);

  if (fetchErr) {
    console.error('[collect-scheduled-charges] fetch error:', fetchErr.message);
    return json({ error: fetchErr.message }, 500);
  }

  const results = { collected: 0, failed: 0 };

  for (const charge of dueCharges ?? []) {
    const fam = charge.families as unknown as {
      parent_email: string;
      parent_first_name: string;
      parent_last_name: string | null;
      stripe_connected_customer_id: string | null;
      primary_location_id: string | null;
    };
    const mem = charge.memberships as unknown as { plan_name: string };
    const parentName = [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' ');

    // ── Helper: mark a charge as failed + trigger declined-payment state ──────
    // Replicates the same DB side effects as stripe-webhook invoice.payment_failed:
    //   - scheduled_charges.status = 'failed'
    //   - memberships.status = 'payment_overdue' (if active or already overdue)
    //   - memberships.payment_failed_at = now   (stamped so in-app banners appear)
    //   - payment_events row with status='failed'
    //   - failure email via Resend
    // Idempotent: won't overwrite cancelled/paused status with payment_overdue.
    async function failCharge(reason: string, stripeIntentId?: string) {
      const now2 = new Date().toISOString();

      // 1. Mark scheduled charge as failed
      await supabase
        .from('scheduled_charges')
        .update({
          status:                  'failed',
          failure_reason:          reason,
          stripe_payment_intent_id: stripeIntentId ?? null,
          updated_at:              now2,
        })
        .eq('id', charge.id);

      // 2. Set membership to payment_overdue + stamp payment_failed_at
      //    (mirrors stripe-webhook invoice.payment_failed behavior exactly)
      await supabase
        .from('memberships')
        .update({ status: 'payment_overdue', payment_failed_at: now2 })
        .eq('id', charge.membership_id)
        .in('status', ['active', 'payment_overdue']);

      // 3. Insert failed payment_events row
      const peErr = await supabase.from('payment_events').insert({
        tenant_id:               charge.tenant_id,
        family_id:               charge.family_id,
        membership_id:           charge.membership_id,
        amount_cents:            charge.amount_cents,
        status:                  'failed',
        payment_method:          'card',
        stripe_payment_intent_id: stripeIntentId ?? null,
        error_code:              reason.slice(0, 100),
        created_at:              now2,
      });
      if (peErr.error) {
        console.error(`[collect-scheduled-charges] payment_events insert (failed) error:`, peErr.error.message);
      }

      // 4. Send failure email
      if (resendKey) {
        const parentName2 = [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' ');
        await sendEmail({
          to: fam.parent_email,
          subject: `Balance payment failed — action required`,
          html: failedEmailHtml({
            parentName: parentName2,
            amountCents: charge.amount_cents,
            planName: mem.plan_name,
            failureReason: reason,
          }),
          resendKey,
          resendFrom,
        });
      }

      results.failed++;
      console.log(`[collect-scheduled-charges] charge=${charge.id} failed: ${reason}`);
    }

    if (!fam.stripe_connected_customer_id) {
      await failCharge('No Stripe customer on file — card was not saved at enrollment');
      continue;
    }

    // Get connected account for location
    let connectedAccountId: string | null = null;
    if (fam.primary_location_id) {
      const { data: loc } = await supabase
        .from('locations')
        .select('stripe_account_id, stripe_onboarding_status')
        .eq('id', fam.primary_location_id)
        .single();
      const locRow = loc as { stripe_account_id?: string; stripe_onboarding_status?: string } | null;
      if (locRow?.stripe_onboarding_status === 'connected') {
        connectedAccountId = locRow.stripe_account_id ?? null;
      }
    }

    if (!connectedAccountId) {
      await failCharge('Location Stripe account not connected — Stripe Connect onboarding incomplete');
      continue;
    }

    const stripeHeaders: Record<string, string> = {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_VERSION,
      'Stripe-Account': connectedAccountId,
    };

    // Get customer's default payment method
    const custRes = await fetch(
      `https://api.stripe.com/v1/customers/${encodeURIComponent(fam.stripe_connected_customer_id)}`,
      { headers: stripeHeaders },
    );
    const custData = await custRes.json() as {
      invoice_settings?: { default_payment_method?: string };
      default_source?: string;
      error?: { message?: string };
    };

    const paymentMethod =
      custData.invoice_settings?.default_payment_method ??
      custData.default_source ??
      null;

    if (!paymentMethod) {
      await failCharge('No default payment method on file — card was not saved or has been removed');
      continue;
    }

    // Create and immediately confirm a PaymentIntent
    const piParams = new URLSearchParams({
      amount: String(charge.amount_cents),
      currency: 'usd',
      customer: fam.stripe_connected_customer_id,
      payment_method: paymentMethod,
      confirm: 'true',
      off_session: 'true',
      'metadata[scheduled_charge_id]': charge.id,
      'metadata[membership_id]': charge.membership_id,
    });

    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: stripeHeaders,
      body: piParams.toString(),
    });
    const piData = await piRes.json() as {
      id?: string;
      status?: string;
      error?: { message?: string; code?: string };
      last_payment_error?: { message?: string; code?: string };
    };

    const now = new Date().toISOString();

    if (piData.status === 'succeeded' && piData.id) {
      // Mark charge paid
      await supabase
        .from('scheduled_charges')
        .update({ status: 'paid', stripe_payment_intent_id: piData.id, updated_at: now })
        .eq('id', charge.id);

      // Recover membership: restore active + clear payment_failed_at
      // (mirrors stripe-webhook invoice.payment_succeeded behavior — lets in-app
      //  banners clear and re-enables normal portal/mobile flows)
      await supabase
        .from('memberships')
        .update({ status: 'active', payment_failed_at: null, updated_at: now })
        .eq('id', charge.membership_id)
        .in('status', ['active', 'payment_overdue']);

      // Insert payment_events row (family_id NOT NULL; method must be 'eft'|'card'|'cash')
      const peInsert = await supabase.from('payment_events').insert({
        tenant_id:               charge.tenant_id,
        family_id:               charge.family_id,
        membership_id:           charge.membership_id,
        amount_cents:            charge.amount_cents,
        status:                  'paid',
        payment_method:          'card',
        stripe_payment_intent_id: piData.id,
        created_at:              now,
      });
      if (peInsert.error) {
        console.error(`[collect-scheduled-charges] payment_events insert (paid) error:`, peInsert.error.message);
      }

      // Send receipt email
      if (resendKey) {
        await sendEmail({
          to: fam.parent_email,
          subject: `Payment received — $${(charge.amount_cents / 100).toFixed(2)}`,
          html: receiptEmailHtml({
            parentName,
            amountCents: charge.amount_cents,
            planName: mem.plan_name,
            chargeDate: charge.charge_date,
          }),
          resendKey,
          resendFrom,
        });
      }

      results.collected++;
      console.log(`[collect-scheduled-charges] charge=${charge.id} collected pi=${piData.id}`);
    } else {
      const failureReason =
        piData.last_payment_error?.message ??
        piData.error?.message ??
        piData.status ??
        'Unknown error';

      // Delegate to the unified failure handler: marks charge failed, sets
      // membership status=payment_overdue + payment_failed_at (same as
      // stripe-webhook invoice.payment_failed), writes payment_events, sends email.
      await failCharge(failureReason, piData.id);
    }
  }

  console.log(`[collect-scheduled-charges] done — collected=${results.collected} failed=${results.failed}`);
  return json({ ok: true, ...results });
});
