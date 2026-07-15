/**
 * POST /api/hq/invite/superadmin
 *
 * Invite a new HQ Admin (super_admin role).
 *
 * Security:
 *  - Caller must be a super_admin verified by JWT claim AND a DB row in super_admins.
 *  - CSPRNG token generated; only SHA-256 hash stored in hq_invites.
 *  - Existing pending invite for the same email is superseded before inserting.
 *  - Raw token sent once in invite email; never logged or stored.
 *  - IP-based rate limiting.
 *  - Audit log on success.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { buildEmailSender, sendResendEmail } from '@/lib/email';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(401, 'Unauthenticated');

  const { data: { session } } = await supabase.auth.getSession();
  if (readAppRole(session) !== 'super_admin') return fail(403, 'Forbidden');

  // DB-level verification: JWT claim alone is not sufficient.
  const serviceClient = createServiceClient();
  const { data: saRow } = await serviceClient
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!saRow) return fail(403, 'Forbidden — no super_admin record found');

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit(`hq-invite:${ip}`, 10, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    email?: string;
    firstName?: string;
    lastName?: string;
  };

  const { email, firstName, lastName } = body;
  if (!email?.trim() || !firstName?.trim() || !lastName?.trim()) {
    return fail(400, 'email, firstName and lastName are required');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminHeaders = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  // Verify no existing auth user with this email.
  const listRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: adminHeaders },
  );
  const listBody = await listRes.json() as { users?: Array<{ email: string }> };
  if ((listBody.users ?? []).some((u) => u.email === email)) {
    return fail(409, `An account with ${email} already exists`);
  }

  // Supersede any existing pending invite for this email.
  await serviceClient
    .from('hq_invites')
    .update({ status: 'superseded' })
    .eq('email', email)
    .eq('status', 'pending');

  // Generate CSPRNG token; store only its SHA-256 hash.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const { data: invite, error: insertError } = await serviceClient
    .from('hq_invites')
    .insert({
      email,
      token_hash: tokenHash,
      role: 'super_admin',
      invited_by: user.id,
    })
    .select('id')
    .single();

  if (insertError || !invite) {
    return fail(500, `Failed to create invite: ${insertError?.message ?? 'unknown'}`);
  }

  // ── Send invite email ─────────────────────────────────────────────────────
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL ??
    `https://${process.env.REPLIT_DEV_DOMAIN}`;

  const claimUrl = `${portalUrl}/auth/claim?token=${rawToken}`;
  const name = `${firstName} ${lastName}`.trim();

  const inviteHtml = `
    <p>Hi ${firstName},</p>
    <p>You've been invited to join <strong>Ballpark HQ</strong> as a <strong>Super Admin</strong>.</p>
    <p>As a Super Admin you'll have full access to the Ballpark network console across all franchise locations.</p>
    <p>Click the button below to set your name and password. This link expires in <strong>72 hours</strong> and can only be used once.</p>
    <p style="margin:24px 0;">
      <a href="${claimUrl}" style="background:#F1E5AD;color:#2D2B2A;padding:13px 28px;border-radius:9px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
        Accept Invitation
      </a>
    </p>
    <p style="color:#888;font-size:12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    <p>— The Ballpark Team</p>
  `;

  const sender = buildEmailSender({ businessName: 'Ballpark HQ' });
  const sendResult = await sendResendEmail({
    to: email,
    subject: "You've been invited to Ballpark HQ",
    text: `Hi ${firstName}, accept your HQ Admin invite: ${claimUrl}`,
    html: inviteHtml,
    ...sender,
  });

  if (!sendResult.ok) {
    // Revoke the invite so another attempt can be made.
    await serviceClient
      .from('hq_invites')
      .update({ status: 'revoked' })
      .eq('id', invite.id);
    return fail(502, `Email delivery failed: ${sendResult.error}`);
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await serviceClient
    .from('hq_audit_log')
    .insert({
      actor_user_id: user.id,
      action: 'invite_issued',
      target_email: email,
      ip,
      metadata: { name, invite_id: invite.id },
    })
    .then(undefined, (e: unknown) =>
      console.error('[hq/invite/superadmin] audit log failed:', e),
    );

  return NextResponse.json({ ok: true, inviteId: invite.id });
}
