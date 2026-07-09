// =============================================================================
// supabase/functions/resume-paused-memberships/index.ts
// =============================================================================
// Task #240 — Membership pause flow — nightly auto-resume cron job
//
// Auth: service-role ONLY. The caller must supply the SUPABASE_SERVICE_ROLE_KEY
// as the Bearer token. Any other token is rejected immediately.
//
// This function uses a direct service-role DB update (not the resume_membership
// RPC, which requires an authenticated user JWT). The service-role client already
// bypasses RLS, and the token gate here provides the authorization boundary.
//
// pg_cron setup (run once in Supabase SQL editor after enabling pg_cron):
//   SELECT cron.schedule(
//     'resume-paused-memberships-daily',
//     '0 6 * * *',
//     $$
//     SELECT net.http_post(
//       url     := current_setting('app.settings.supabase_url')
//                  || '/functions/v1/resume-paused-memberships',
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
//   npx supabase functions deploy resume-paused-memberships
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

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

async function sendResumeEmail(
  parentEmail: string,
  parentFirst: string,
  planName: string,
  businessName?: string | null,
  replyToEmail?: string | null,
): Promise<void> {
  if (!RESEND_API_KEY) return;
  const today = formatDateLong(new Date().toISOString().slice(0, 10));
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
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#f5f0e8;">Hi ${parentFirst},</p>
            <p style="margin:0 0 14px;font-size:14px;color:#a0967e;line-height:1.6;">
              Great news — your <strong style="color:#f5f0e8;">${planName}</strong> has
              automatically resumed as of <strong style="color:#f5f0e8;">${today}</strong>.
            </p>
            <p style="margin:0 0 14px;font-size:13px;color:#a0967e;line-height:1.6;">
              Your regular billing cycle will restart on your next billing date.
              We're excited to have your athlete back!
            </p>
            <p style="margin:0;font-size:11px;color:#4a4438;">
              This is an automated confirmation. Contact the facility if you have any questions.
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
    subject: `Your ${planName} has resumed`,
    text: `Your ${planName} has resumed`,
    html,
    ...sender,
  });
  if (!result.ok) {
    console.error(`[resume-paused-memberships] Resend error: ${result.error}`);
  }
}

async function stripeRemovePause(
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
    body: 'pause_collection=',
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
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

  // ── Service-role gate ─────────────────────────────────────────────────────
  // This function performs privileged multi-tenant operations.
  // Only the pg_cron job (which supplies the service-role key as Bearer) is permitted.
  const authHeader  = req.headers.get('Authorization') ?? '';
  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerToken || callerToken !== serviceKey) {
    return json({ error: { code: 'unauthorized', message: 'Service-role token required' } }, 401);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json({ error: { code: 'config_error', message: 'Stripe not configured' } }, 500);
  }

  // Service-role client bypasses RLS — authorized by the token gate above.
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Find all overdue-paused memberships ───────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: toResume, error: queryErr } = await supabase
    .from('memberships')
    .select(`
      id, plan_name, stripe_subscription_id, tenant_id,
      families!inner(primary_location_id, parent_email, parent_first_name, parent_user_id)
    `)
    .eq('status', 'paused')
    .lte('pause_end', todayStr);

  if (queryErr) {
    console.error(`[resume-paused-memberships] query error: ${queryErr.message}`);
    return json({ error: { code: 'db_error', message: queryErr.message } }, 500);
  }

  if (!toResume || toResume.length === 0) {
    console.log('[resume-paused-memberships] no memberships to resume — done');
    return json({ ok: true, processed: 0, resumed: 0, errors: [] });
  }

  console.log(`[resume-paused-memberships] found ${toResume.length} membership(s) to resume`);

  // ── Resolve connected account IDs in bulk ─────────────────────────────────
  const locationIds = [...new Set(
    toResume.map(m => (m.families as unknown as { primary_location_id: string }).primary_location_id),
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

  const tenantIds = [...new Set(toResume.map(m => m.tenant_id as string).filter(Boolean))];
  const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds);
  const nameByTenant: Record<string, string | null> = {};
  for (const t of (tenants ?? [])) {
    nameByTenant[t.id] = (t as { name?: string }).name ?? null;
  }

  // ── Process each membership ───────────────────────────────────────────────
  let resumed = 0;
  const errors: string[] = [];

  for (const mem of toResume) {
    const fam = mem.families as unknown as { primary_location_id: string; parent_email: string; parent_first_name: string; parent_user_id: string };
    const connectedAccountId = accountByLocation[fam.primary_location_id] ?? undefined;

    try {
      // Remove Stripe pause
      if (mem.stripe_subscription_id) {
        await stripeRemovePause(
          mem.stripe_subscription_id as string,
          stripeKey,
          connectedAccountId,
        );
      }

      // Direct service-role DB update (does NOT use the resume_membership RPC,
      // which requires an authenticated user JWT for auth.jwt() derivation).
      // The authorization boundary is the service-role token gate at the top.
      const { error: updateErr } = await supabase
        .from('memberships')
        .update({
          status:      'active',
          pause_start: null,
          pause_end:   null,
          paused_at:   null,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', mem.id)
        .eq('status', 'paused');  // Idempotency guard

      if (updateErr) {
        throw new Error(`DB update failed: ${updateErr.message}`);
      }

      resumed++;
      console.log(`[resume-paused-memberships] resumed membership=${mem.id}`);
      // Best-effort: email + push notification to parent
      const planName = mem.plan_name as string ?? 'your membership';
      Promise.allSettled([
        sendResumeEmail(
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
            title: '▶ Membership Resumed',
            body: `Your ${planName} is now active again. Welcome back!`,
            data: { kind: 'membership_resumed', membership_id: mem.id },
          }),
        }) : Promise.resolve(),
      ]).then(results => {
        for (const r of results) {
          if (r.status === 'rejected') console.error(`[resume-paused-memberships] notification error for ${mem.id}:`, r.reason);
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[resume-paused-memberships] failed membership=${mem.id}: ${msg}`);
      errors.push(`${mem.id}: ${msg}`);
    }
  }

  const summary = {
    ok: errors.length === 0,
    processed: toResume.length,
    resumed,
    skipped: toResume.length - resumed - errors.length,
    errors,
  };
  console.log('[resume-paused-memberships] run complete:', JSON.stringify(summary));
  return json(summary);
});
