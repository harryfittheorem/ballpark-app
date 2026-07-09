// =============================================================================
// supabase/functions/enforce-payment-pause/index.ts
// =============================================================================
// Cron job that enforces payment-overdue pauses. The stripe-webhook sets
// payment_pause_scheduled_at = now() + 24h on the 3rd consecutive failure.
// This function runs at 08:00 UTC daily (after the charge cron), finds any
// membership whose scheduled pause time has passed, calls Stripe
// pause_collection, updates the DB, and sends the parent a paused-membership
// email.
//
// Auth: service-role token required (same pattern as resume-paused-memberships).
//
// pg_cron setup (run once in Supabase SQL editor):
//   SELECT cron.schedule(
//     'enforce-payment-pause-daily',
//     '0 8 * * *',
//     $$
//     SELECT net.http_post(
//       url     := current_setting('app.settings.supabase_url')
//                  || '/functions/v1/enforce-payment-pause',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'Authorization', 'Bearer '
//           || current_setting('app.settings.service_role_key')
//       ),
//       body    := '{}'::jsonb
//     );
//     $$
//   );
//
// Deploy with:
//   npx supabase functions deploy enforce-payment-pause
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEmailSender, sendResendEmail as sendBrandedEmail } from '../_shared/email.ts';

const STRIPE_API_VERSION = '2024-06-20';
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function stripePauseCollection(
  subscriptionId: string,
  secretKey: string,
  stripeAccountId?: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'POST',
    headers,
    body: 'pause_collection[behavior]=void',
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
  }
}

async function sendPaymentPausedEmail(
  parentEmail: string,
  parentFirst: string,
  planName: string,
  businessName?: string | null,
  replyToEmail?: string | null,
): Promise<void> {
  if (!RESEND_API_KEY) return;
  const appDeepLink = 'ballpark://me/payment-method';
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#1a1a1a;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:#cfab56;padding:20px 28px;">
            <span style="font-size:18px;font-weight:800;color:#1a1a1a;">⚾ Ballpark</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h2 style="margin:0 0 12px;font-size:18px;color:#e74c3c;">Membership paused — payment required</h2>
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#f5f0e8;">Hi ${parentFirst},</p>
            <p style="margin:0 0 14px;font-size:14px;color:#a0967e;line-height:1.6;">
              Your <strong style="color:#f5f0e8;">${planName}</strong> has been
              <strong style="color:#e74c3c;">paused</strong> because we were unable
              to process payment after multiple attempts.
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#a0967e;line-height:1.6;">
              To reactivate your membership, please update your payment method.
              Once your card is updated, Stripe will retry the charge automatically
              and your membership will resume immediately upon success.
            </p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${appDeepLink}"
                 style="display:inline-block;background:#d4a843;color:#1a1a1a;
                        font-weight:700;font-size:15px;padding:14px 28px;
                        border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                Update Payment Method →
              </a>
            </div>
            <p style="margin:0;font-size:11px;color:#4a4438;">
              Questions? Reply to this email or contact your facility directly.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const sender = buildEmailSender({ businessName, replyToEmail });
  const result = await sendBrandedEmail({
    to: parentEmail,
    subject: `Your ${planName} has been paused — update payment to reactivate`,
    text: `Your ${planName} has been paused — update payment to reactivate`,
    html,
    ...sender,
  });
  if (!result.ok) {
    console.error(`[enforce-payment-pause] Resend error: ${result.error}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: { code: 'method_not_allowed', message: 'POST only' } }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader  = req.headers.get('Authorization') ?? '';
  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerToken || callerToken !== serviceKey) {
    return json({ error: { code: 'unauthorized', message: 'Service-role token required' } }, 401);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json({ error: { code: 'config_error', message: 'Stripe not configured' } }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const nowIso   = new Date().toISOString();

  // ── Find memberships where pause is due ──────────────────────────────────
  const { data: toPause, error: queryErr } = await supabase
    .from('memberships')
    .select(`
      id, plan_name, stripe_subscription_id, tenant_id,
      families!inner(primary_location_id, parent_email, parent_first_name, parent_user_id)
    `)
    .not('payment_pause_scheduled_at', 'is', null)
    .lte('payment_pause_scheduled_at', nowIso)
    .not('status', 'eq', 'paused')
    .not('status', 'eq', 'cancelled');

  if (queryErr) {
    console.error(`[enforce-payment-pause] query error: ${queryErr.message}`);
    return json({ error: { code: 'db_error', message: queryErr.message } }, 500);
  }

  if (!toPause || toPause.length === 0) {
    console.log('[enforce-payment-pause] no memberships due for pause — done');
    return json({ ok: true, processed: 0, paused: 0, errors: [] });
  }

  console.log(`[enforce-payment-pause] found ${toPause.length} membership(s) to pause`);

  // ── Resolve connected Stripe accounts in bulk ─────────────────────────────
  const locationIds = [...new Set(
    toPause.map(m => (m.families as unknown as { primary_location_id: string }).primary_location_id),
  )];
  const { data: locations } = await supabase
    .from('locations')
    .select('id, stripe_account_id, email')
    .in('id', locationIds);

  const accountByLocation: Record<string, string | null> = {};
  const emailByLocation: Record<string, string | null> = {};
  for (const loc of (locations ?? [])) {
    accountByLocation[loc.id] = loc.stripe_account_id as string | null;
    emailByLocation[loc.id] = (loc.email as string | null) ?? null;
  }

  const tenantIds = [...new Set(toPause.map(m => m.tenant_id as string).filter(Boolean))];
  const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds);
  const nameByTenant: Record<string, string | null> = {};
  for (const t of (tenants ?? [])) {
    nameByTenant[t.id] = (t as { name?: string }).name ?? null;
  }

  let paused = 0;
  const errors: string[] = [];

  for (const mem of toPause) {
    const fam = mem.families as unknown as {
      primary_location_id: string;
      parent_email: string;
      parent_first_name: string;
      parent_user_id: string;
    };
    const connectedAccountId = accountByLocation[fam.primary_location_id] ?? undefined;

    try {
      if (mem.stripe_subscription_id) {
        await stripePauseCollection(
          mem.stripe_subscription_id as string,
          stripeKey,
          connectedAccountId,
        );
      }

      const { error: updateErr } = await supabase
        .from('memberships')
        .update({
          status:                      'paused',
          payment_paused_reason:       'payment_overdue',
          payment_pause_scheduled_at:  null,
          paused_at:                   nowIso,
          updated_at:                  nowIso,
        })
        .eq('id', mem.id)
        .not('status', 'eq', 'paused');

      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

      paused++;
      console.log(`[enforce-payment-pause] paused membership=${mem.id}`);

      const planName = (mem.plan_name as string) ?? 'your membership';
      Promise.allSettled([
        sendPaymentPausedEmail(
          fam.parent_email,
          fam.parent_first_name ?? 'there',
          planName,
          nameByTenant[mem.tenant_id as string] ?? null,
          emailByLocation[fam.primary_location_id] ?? null,
        ),
        fam.parent_user_id ? fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_ids: [fam.parent_user_id],
            title: '⏸ Membership Paused',
            body: `Your ${planName} is paused. Update your payment method to reactivate.`,
            data: { kind: 'membership_payment_paused', screen: 'PaymentMethod' },
          }),
        }) : Promise.resolve(),
      ]).then(results => {
        for (const r of results) {
          if (r.status === 'rejected') {
            console.error(`[enforce-payment-pause] notification error for ${mem.id}:`, r.reason);
          }
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[enforce-payment-pause] failed membership=${mem.id}: ${msg}`);
      errors.push(`${mem.id}: ${msg}`);
    }
  }

  const summary = {
    ok: errors.length === 0,
    processed: toPause.length,
    paused,
    skipped: toPause.length - paused - errors.length,
    errors,
  };
  console.log('[enforce-payment-pause] run complete:', JSON.stringify(summary));
  return json(summary);
});
