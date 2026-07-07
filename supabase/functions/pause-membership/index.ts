// =============================================================================
// supabase/functions/pause-membership/index.ts
// =============================================================================
// Task #240 — Membership pause flow
//
// Auth model: Supabase JWT required. Accepts parent OR owner/admin role.
//   - parent: can only pause their own family's membership.
//   - owner/admin: can pause any membership in their tenant.
//
// Authorization is enforced inside the pause_membership() SECURITY DEFINER RPC,
// which derives identity from auth.jwt() / auth.uid() — no caller-supplied role params.
//
// Flow (all validations happen BEFORE Stripe to prevent billing state divergence):
//   1. Verify JWT and extract role
//   2. Load membership + validate scope/business rules in pre-flight queries
//   3. Check family-level overlap (before Stripe)
//   4. Call Stripe pause_collection[behavior]=void
//   5. Call pause_membership() RPC to atomically update DB
//
// Deploy with:
//   npx supabase functions deploy pause-membership
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL  = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function encodeFormBody(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = encodeFormBody(v as Record<string, unknown>, key);
      if (nested) parts.push(nested);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

async function stripePost(
  path: string,
  secretKey: string,
  body: Record<string, unknown>,
  stripeAccountId?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers,
    body: encodeFormBody(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
  }
  return data;
}

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

async function sendPauseEmail(
  parentEmail: string,
  parentFirst: string,
  planName: string,
  pauseStart: string,
  pauseEnd: string,
): Promise<void> {
  if (!RESEND_API_KEY) return;
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
              Your <strong style="color:#f5f0e8;">${planName}</strong> has been paused.
              Here are the details:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#252525;border-radius:8px;margin:0 0 16px;">
              <tr><td style="padding:16px 18px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#6b6354;padding-bottom:8px;">PAUSED FROM</td>
                    <td align="right" style="font-size:12px;font-weight:700;color:#f5f0e8;padding-bottom:8px;">${formatDateLong(pauseStart)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b6354;">AUTO-RESUMES</td>
                    <td align="right" style="font-size:12px;font-weight:700;color:#cfab56;">${formatDateLong(pauseEnd)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 14px;font-size:13px;color:#a0967e;line-height:1.6;">
              No billing charges will occur during the pause window.
              Your membership will automatically resume on ${formatDateLong(pauseEnd)}.
            </p>
            <p style="margin:0;font-size:11px;color:#4a4438;">
              This is an automated confirmation. Contact the facility if you need to adjust your pause dates.
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
      subject: `Your ${planName} is paused — resumes ${formatDateLong(pauseEnd)}`,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error(`[pause-membership] Resend error ${res.status}: ${txt.slice(0, 200)}`);
  }
}

const ERROR_MAP: Record<string, { message: string; status: number }> = {
  unauthorized:          { message: 'Authentication required',                                          status: 401 },
  forbidden:             { message: 'Access denied',                                                    status: 403 },
  not_found:             { message: 'Membership not found',                                             status: 404 },
  already_paused:        { message: 'This membership is already paused',                                status: 409 },
  family_already_paused: { message: 'Another membership in this family is already paused',             status: 409 },
  not_active:            { message: 'Only active memberships can be paused',                            status: 422 },
  not_eft:               { message: 'Only EFT recurring memberships can be paused',                    status: 422 },
  pause_too_short:       { message: 'Pause end must be at least 7 days from today',                    status: 422 },
  pause_too_long:        { message: 'Pause end cannot be more than 90 days from today',                status: 422 },
};

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

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json({ error: { code: 'config_error', message: 'Stripe not configured' } }, 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

  // ── Verify JWT ────────────────────────────────────────────────────────────
  const authHeader  = req.headers.get('Authorization') ?? '';
  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerToken) {
    return json({ error: { code: 'unauthorized', message: 'Missing Authorization header' } }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });
  const { data: { user }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !user) {
    return json({ error: { code: 'unauthorized', message: 'Invalid token' } }, 401);
  }

  const userRole = (user.app_metadata?.app_role as string | undefined)
    ?? (user.user_metadata?.app_role as string | undefined) ?? '';

  // Accept any authenticated user. If the role claim is absent (Custom Access
  // Token Hook not running in this environment), we fall back to treating the
  // caller as a parent and enforce ownership via fam.parent_user_id below.
  // Owner/admin callers still require an explicit role claim.

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { membership_id?: string; pause_end?: string };
  try { body = await req.json(); } catch {
    return json({ error: { code: 'bad_json', message: 'Invalid request body' } }, 400);
  }

  const { membership_id, pause_end } = body;
  if (!membership_id || !pause_end) {
    return json({ error: { code: 'missing_param', message: 'membership_id and pause_end required' } }, 422);
  }

  const pauseEndDate = new Date(pause_end);
  if (isNaN(pauseEndDate.getTime())) {
    return json({ error: { code: 'invalid_date', message: 'pause_end must be YYYY-MM-DD' } }, 422);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((pauseEndDate.getTime() - today.getTime()) / 86_400_000);
  // Use 6 days (not 7) to allow 1 day of timezone buffer: clients in UTC-N
  // send "7 days from local today" which can appear as 6 days on the UTC server.
  if (diffDays < 6) {
    return json({ error: { code: 'pause_too_short', message: 'Pause end must be at least 7 days from today' } }, 422);
  }
  if (diffDays > 91) {
    return json({ error: { code: 'pause_too_long', message: 'Pause end cannot be more than 90 days from today' } }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Pre-flight: load membership (service-role, for Stripe details) ────────
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select(`
      id, plan_name, plan_type, status, stripe_subscription_id, tenant_id, family_id,
      families!inner(id, parent_user_id, parent_email, parent_first_name, primary_location_id)
    `)
    .eq('id', membership_id)
    .single();

  if (memErr || !mem) {
    return json({ error: { code: 'not_found', message: 'Membership not found' } }, 404);
  }

  // ── Pre-flight scope check (mirrors RPC check) ────────────────────────────
  const fam = mem.families as unknown as { id: string; parent_user_id: string; parent_email: string; parent_first_name: string; primary_location_id: string };
  // The Custom Access Token Hook injects tenant_id into the JWT payload only —
  // NOT into raw_app_meta_data. Decode the token directly; fall back to
  // app_metadata for environments where the hook is absent.
  const callerTenant: string | null = (() => {
    try {
      const parts = callerToken.split('.');
      if (parts.length < 2) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
      return (payload.tenant_id as string | undefined)
        ?? (user.app_metadata?.tenant_id as string | undefined)
        ?? null;
    } catch {
      return (user.app_metadata?.tenant_id as string | undefined) ?? null;
    }
  })();

  const isOwnerAdmin = ['owner', 'admin'].includes(userRole);
  if (isOwnerAdmin) {
    if (!callerTenant || mem.tenant_id !== callerTenant) {
      return json({ error: { code: 'forbidden', message: 'Access denied — tenant mismatch' } }, 403);
    }
  } else {
    // parent or unauthenticated-role-claim: verify family ownership
    if (fam.parent_user_id !== user.id) {
      return json({ error: { code: 'forbidden', message: 'Access denied' } }, 403);
    }
  }

  // ── Pre-flight business rule checks (BEFORE Stripe) ──────────────────────
  if (mem.plan_type !== 'eft') {
    return json({ error: { code: 'not_eft', message: 'Only EFT recurring memberships can be paused' } }, 422);
  }
  if (mem.status === 'paused') {
    return json({ error: { code: 'already_paused', message: 'This membership is already paused' } }, 409);
  }
  if (mem.status !== 'active') {
    return json({ error: { code: 'not_active', message: 'Only active memberships can be paused' } }, 422);
  }
  // ── Pre-flight family-level overlap check (BEFORE Stripe) ────────────────
  const { data: familyPaused } = await supabase
    .from('memberships')
    .select('id')
    .eq('family_id', mem.family_id)
    .neq('id', membership_id)
    .eq('status', 'paused')
    .gte('pause_end', today.toISOString().slice(0, 10))
    .limit(1);

  if (familyPaused && familyPaused.length > 0) {
    return json({
      error: {
        code: 'family_already_paused',
        message: 'Another membership in this family is already paused for an overlapping period',
      },
    }, 409);
  }

  // ── Resolve Stripe connected account ──────────────────────────────────────
  const { data: location } = await supabase
    .from('locations')
    .select('stripe_account_id')
    .eq('id', fam.primary_location_id)
    .single();

  const connectedAccountId = location?.stripe_account_id as string | null;

  // ── Pause Stripe subscription (only when one is linked) ──────────────────
  const pauseEndStr    = pause_end.slice(0, 10);

  if (mem.stripe_subscription_id) {
    const resumesAtEpoch = Math.floor(pauseEndDate.getTime() / 1000);
    try {
      await stripePost(
        `subscriptions/${mem.stripe_subscription_id as string}`,
        stripeKey,
        {
          'pause_collection[behavior]': 'void',
          'pause_collection[resumes_at]': resumesAtEpoch,
        },
        connectedAccountId ?? undefined,
      );
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : 'Unknown Stripe error';
      console.error(`[pause-membership] Stripe error: ${msg}`);
      return json({ error: { code: 'stripe_error', message: msg } }, 502);
    }
  } else {
    console.log(`[pause-membership] no stripe_subscription_id — skipping Stripe, updating DB only`);
  }

  // ── Update DB via SECURITY DEFINER RPC (JWT-derived auth inside RPC) ─────
  // The RPC re-derives auth from the caller's JWT, so we pass it the caller token.
  // This keeps the DB write atomic with a server-side ownership/scope re-check.
  const { data: rpcResult, error: rpcErr } = await callerClient.rpc('pause_membership', {
    p_membership_id: membership_id,
    p_pause_end:     pauseEndStr,
  });

  if (rpcErr) {
    console.error(`[pause-membership] RPC error: ${rpcErr.message}`);
    // Stripe was paused but DB failed — log prominently; operator must reconcile.
    return json({ error: { code: 'db_error', message: 'Stripe paused but DB update failed — contact support' } }, 500);
  }

  const result = rpcResult as { ok: boolean; code?: string; pause_start?: string; pause_end?: string };
  if (!result.ok) {
    console.error(`[pause-membership] RPC rejected: ${result.code}`);
    const mapped = result.code ? ERROR_MAP[result.code] : undefined;
    return json(
      { error: { code: result.code ?? 'rpc_error', message: mapped?.message ?? 'DB update rejected' } },
      mapped?.status ?? 500,
    );
  }

  console.log(`[pause-membership] paused membership=${membership_id} pause_end=${pauseEndStr}`);

  // Best-effort: email + push notification to parent
  const pauseStartStr = result.pause_start ?? new Date().toISOString().slice(0, 10);
  const resolvedPauseEnd = result.pause_end ?? pauseEndStr;
  const planName = mem.plan_name as string ?? 'your membership';

  Promise.allSettled([
    sendPauseEmail(fam.parent_email, fam.parent_first_name ?? 'there', planName, pauseStartStr, resolvedPauseEnd),
    fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_ids: [fam.parent_user_id],
        title: '⏸ Membership Paused',
        body: `Your ${planName} is paused until ${formatDateLong(resolvedPauseEnd)}.`,
        data: { kind: 'membership_paused', membership_id },
      }),
    }),
  ]).then(results => {
    for (const r of results) {
      if (r.status === 'rejected') console.error('[pause-membership] notification error:', r.reason);
    }
  });

  return json({ ok: true, pause_start: result.pause_start, pause_end: result.pause_end });
});
