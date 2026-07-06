// =============================================================================
// supabase/functions/process-membership-cancellations/index.ts
// =============================================================================
// Task #238 — Cancellation Policy Enforcement
// Task #519 — Wire up cancellation cron (improved logging)
//
// Daily cron (scheduled via pg_cron 0 2 * * *) that finalises memberships
// whose cancel_effective_at <= NOW():
//   1. Cancels the Stripe subscription immediately (not at period end — it
//      already reached the effective date the parent was shown).
//   2. Sets memberships.status = 'cancelled' and memberships.cancelled_at = now().
//
// Safe to invoke manually for testing:
//   curl -X POST https://<project>.supabase.co/functions/v1/process-membership-cancellations \
//     -H "Authorization: Bearer <service_role_key>"
//
// Returns HTTP 200 with { processed: N, cancelled: N, errors: [...] }
//
// Deploy:
//   npx supabase functions deploy process-membership-cancellations
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION  = '2024-06-20';
const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL   = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
const SUPABASE_URL_ENV    = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function encodeFormBody(obj: Record<string, string | boolean | number>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}

function formatDateLong(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

async function sendCancellationEffectiveEmail(
  parentEmail: string,
  parentFirst: string,
  planName: string,
): Promise<void> {
  if (!RESEND_API_KEY) return;
  const today = formatDateLong(new Date().toISOString());
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
              Your <strong style="color:#f5f0e8;">${planName}</strong> membership has been cancelled
              as of <strong style="color:#f5f0e8;">${today}</strong>.
            </p>
            <p style="margin:0 0 14px;font-size:13px;color:#a0967e;line-height:1.6;">
              No further billing charges will occur. We hope to see your athlete
              back on the field soon — reach out to the facility any time to re-enroll.
            </p>
            <p style="margin:0;font-size:11px;color:#4a4438;">
              This is an automated confirmation. No action is required.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [parentEmail],
      subject: `Your ${planName} membership has been cancelled`,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error(`[process-membership-cancellations] Resend error ${res.status}: ${txt.slice(0, 200)}`);
  }
}

async function stripeDel(
  path: string,
  secretKey: string,
  stripeAccountId?: string | null,
): Promise<{ id: string; status: string }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'DELETE',
    headers,
    body: encodeFormBody({}),
  });

  if (res.status === 404) {
    // Already gone — treat as success
    return { id: path.split('/').pop() ?? '', status: 'canceled' };
  }

  const data = await res.json() as { id?: string; status?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe error ${res.status}`);
  }
  return { id: data.id ?? '', status: data.status ?? 'canceled' };
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
    return json({ error: 'POST only' }, 405);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, serviceKey);

  // Load all memberships that are due for cancellation
  const { data: memberships, error: fetchErr } = await supabase
    .from('memberships')
    .select(`
      id, tenant_id, stripe_subscription_id, cancel_effective_at, plan_name,
      families!inner(id, primary_location_id, parent_email, parent_first_name)
    `)
    .not('cancel_effective_at', 'is', null)
    .lte('cancel_effective_at', new Date().toISOString())
    .neq('status', 'cancelled');

  if (fetchErr) {
    console.error('[process-membership-cancellations] fetch error:', fetchErr.message);
    return json({ error: fetchErr.message }, 500);
  }

  if (!memberships || memberships.length === 0) {
    console.log('[process-membership-cancellations] no eligible memberships — done');
    return json({ processed: 0, cancelled: 0, errors: [] });
  }

  console.log(`[process-membership-cancellations] processing ${memberships.length} membership(s)`);

  let cancelled = 0;
  const errors: { id: string; error: string }[] = [];

  for (const mem of memberships) {
    try {
      let stripeAccountId: string | null = null;
      const fam = mem.families as unknown as { id: string; primary_location_id: string; parent_email: string; parent_first_name: string };

      if (mem.stripe_subscription_id && stripeKey) {
        // Resolve connected Stripe account for this location
        if (fam?.primary_location_id) {
          const { data: loc } = await supabase
            .from('locations')
            .select('stripe_account_id')
            .eq('id', fam.primary_location_id)
            .single();
          stripeAccountId = (loc?.stripe_account_id as string | null) ?? null;
        }

        // Cancel the Stripe subscription immediately
        await stripeDel(
          `subscriptions/${mem.stripe_subscription_id}`,
          stripeKey,
          stripeAccountId,
        );
        console.log(`[process-membership-cancellations] Stripe sub ${mem.stripe_subscription_id} cancelled`);
      } else if (!stripeKey) {
        console.warn(`[process-membership-cancellations] STRIPE_SECRET_KEY not set — skipping Stripe cancellation for ${mem.id}`);
      }

      // Update DB: mark cancelled
      const { error: updateErr } = await supabase
        .from('memberships')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', mem.id)
        .eq('tenant_id', mem.tenant_id);

      if (updateErr) {
        console.error(`[process-membership-cancellations] DB update error for ${mem.id}:`, updateErr.message);
        errors.push({ id: mem.id, error: updateErr.message });
        continue;
      }

      cancelled++;
      console.log(`[process-membership-cancellations] membership ${mem.id} → cancelled`);
      // Best-effort cancellation-effective email to parent
      sendCancellationEffectiveEmail(fam.parent_email, fam.parent_first_name, mem.plan_name as string)
        .catch(e => console.error(`[process-membership-cancellations] email failed for ${mem.id}:`, (e as Error).message));
    } catch (err) {
      const e = err as Error;
      console.error(`[process-membership-cancellations] error for ${mem.id}:`, e.message);
      errors.push({ id: mem.id, error: e.message });
    }
  }

  const summary = {
    processed: memberships.length,
    cancelled,
    skipped: memberships.length - cancelled - errors.length,
    errors,
  };
  console.log('[process-membership-cancellations] run complete:', JSON.stringify(summary));
  return json(summary);
});
