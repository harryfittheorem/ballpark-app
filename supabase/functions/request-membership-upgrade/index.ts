// =============================================================================
// supabase/functions/request-membership-upgrade/index.ts
// =============================================================================
// Task #371 — Membership upgrade request
//
// Auth model: Supabase JWT required (parent role).
//   Validates the caller owns the membership, then:
//   1. Validates the requested plan is a valid upgrade (higher tier, same tenant)
//   2. Inserts a row into membership_upgrade_requests
//   3. Sends notification email to the tenant admin via Resend
//   Returns { ok: true }
//
// Deploy with:
//   npx supabase functions deploy request-membership-upgrade
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEmailSender, sendResendEmail as sendBrandedEmail } from '../_shared/email.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
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

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY')!;

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

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { membership_id?: string; requested_plan_id?: string };
  try { body = await req.json(); } catch {
    return json({ error: { code: 'bad_json', message: 'Invalid request body' } }, 400);
  }

  const { membership_id, requested_plan_id } = body;
  if (!membership_id || !requested_plan_id) {
    return json({
      error: { code: 'missing_param', message: 'membership_id and requested_plan_id required' },
    }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Load membership + verify caller owns it ───────────────────────────────
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select(`
      id, plan_name, plan_type, amount_cents, status, tenant_id, family_id,
      families!inner(id, parent_user_id)
    `)
    .eq('id', membership_id)
    .single();

  if (memErr || !mem) {
    return json({ error: { code: 'not_found', message: 'Membership not found' } }, 404);
  }

  const fam = mem.families as unknown as { id: string; parent_user_id: string };
  if (fam.parent_user_id !== user.id) {
    return json({ error: { code: 'forbidden', message: 'Access denied' } }, 403);
  }

  if (mem.status !== 'active') {
    return json({ error: { code: 'not_active', message: 'Only active memberships can be upgraded' } }, 422);
  }

  // ── Validate requested plan ───────────────────────────────────────────────
  const { data: plan, error: planErr } = await supabase
    .from('membership_plans')
    .select('id, name, amount_cents, is_active, tenant_id')
    .eq('id', requested_plan_id)
    .single();

  if (planErr || !plan) {
    return json({ error: { code: 'plan_not_found', message: 'Plan not found' } }, 404);
  }

  if (plan.tenant_id !== mem.tenant_id) {
    return json({ error: { code: 'forbidden', message: 'Plan belongs to a different tenant' } }, 403);
  }
  if (!plan.is_active) {
    return json({ error: { code: 'plan_inactive', message: 'Plan is no longer available' } }, 422);
  }
  if (plan.amount_cents <= mem.amount_cents) {
    return json({ error: { code: 'not_upgrade', message: 'Requested plan is not a higher tier' } }, 422);
  }

  // ── Insert upgrade request ─────────────────────────────────────────────────
  const { error: insertErr } = await supabase
    .from('membership_upgrade_requests')
    .insert({
      tenant_id:         mem.tenant_id,
      family_id:         fam.id,
      membership_id:     membership_id,
      requested_plan_id: requested_plan_id,
      status:            'pending',
    });

  if (insertErr) {
    console.error('[request-membership-upgrade] insert error:', insertErr.message);
    return json({ error: { code: 'db_error', message: 'Failed to save upgrade request' } }, 500);
  }

  // ── Load tenant contact email + parent name for email ─────────────────────
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, contact_email')
    .eq('id', mem.tenant_id)
    .single();

  const { data: profile } = await supabase
    .from('families')
    .select('first_name, last_name, email')
    .eq('id', fam.id)
    .single();

  const tenantName    = tenant?.name ?? 'Your facility';
  const adminEmail    = tenant?.contact_email ?? null;
  const parentName    = profile ? `${profile.first_name} ${profile.last_name}` : 'A parent';
  const parentEmail   = profile?.email ?? '(email not on file)';
  const currentPlan   = mem.plan_name;
  const requestedPlan = plan.name;
  const requestedAmt  = `$${(plan.amount_cents / 100).toFixed(2)}/mo`;

  // ── Send email to tenant admin ─────────────────────────────────────────────
  if (RESEND_API_KEY && adminEmail) {
    const sender = buildEmailSender({ businessName: tenantName, replyToEmail: parentEmail !== '(email not on file)' ? parentEmail : null });
    const html = `
<p>Hi ${tenantName} team,</p>
<p><strong>${parentName}</strong> (${parentEmail}) has submitted a membership upgrade request through the Ballpark app.</p>
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
  <tr><td style="color:#666;padding-right:16px;">Current plan</td><td><strong>${currentPlan}</strong></td></tr>
  <tr><td style="color:#666;padding-right:16px;">Requested plan</td><td><strong>${requestedPlan}</strong> (${requestedAmt})</td></tr>
</table>
<p>Please reach out to the family to confirm availability and process the change in your billing system.</p>
<p style="color:#999;font-size:12px;">This request was generated automatically by the Ballpark app.</p>
    `.trim();
    const result = await sendBrandedEmail({
      to: adminEmail,
      subject: `Membership upgrade request — ${parentName}`,
      text: `Membership upgrade request from ${parentName} (${parentEmail}): ${currentPlan} → ${requestedPlan} (${requestedAmt})`,
      html,
      ...sender,
    });
    if (!result.ok) {
      console.error('[request-membership-upgrade] email error:', result.error);
    }
  } else if (!RESEND_API_KEY) {
    console.warn('[request-membership-upgrade] RESEND_API_KEY not set — skipping email');
  } else {
    console.warn('[request-membership-upgrade] tenant has no contact_email — skipping email');
  }

  console.log(
    `[request-membership-upgrade] membership=${membership_id} plan=${requested_plan_id} family=${fam.id}`,
  );

  return json({ ok: true });
});
