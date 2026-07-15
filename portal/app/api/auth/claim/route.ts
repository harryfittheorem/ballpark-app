/**
 * POST /api/auth/claim
 *
 * Claim a pending HQ Admin invite using the raw token from the invite email.
 *
 * Security guarantees:
 *  - Token is hashed with SHA-256 before lookup; raw token never logged.
 *  - Timing-safe comparison of stored hash vs computed hash.
 *  - Single-use: invite status set to 'claimed' atomically.
 *  - Email address is read from the invite record; client-submitted email
 *    must match exactly (rejects substitution attempts).
 *  - Email uniqueness enforced before auth user creation.
 *  - IP-based rate limiting.
 *  - Audit log on success.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`auth-claim:${ip}`, 10, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => ({})) as {
    token?: string;
    name?: string;
    password?: string;
    email?: string;
  };

  const { token, name, password, email: submittedEmail } = body;
  if (!token || !name?.trim() || !password || !submittedEmail) {
    return fail(400, 'token, name, email and password are required');
  }
  if (password.length < 8) {
    return fail(400, 'Password must be at least 8 characters');
  }

  // Compute SHA-256 hash of submitted token.
  const computedHash = crypto.createHash('sha256').update(token).digest('hex');

  const serviceClient = createServiceClient();

  // Look up invite by computed hash.
  const { data: invite } = await serviceClient
    .from('hq_invites')
    .select('id, email, status, expires_at, token_hash')
    .eq('token_hash', computedHash)
    .maybeSingle();

  if (!invite) return fail(404, 'Invalid or expired invitation link');

  // Timing-safe comparison of stored hash vs computed hash.
  const storedHashBuf = Buffer.from(invite.token_hash, 'utf8');
  const computedHashBuf = Buffer.from(computedHash, 'utf8');
  const hashesMatch =
    storedHashBuf.length === computedHashBuf.length &&
    crypto.timingSafeEqual(storedHashBuf, computedHashBuf);

  if (!hashesMatch) return fail(404, 'Invalid or expired invitation link');

  if (invite.status !== 'pending') {
    return fail(409, `This invitation has already been ${invite.status}`);
  }

  if (new Date(invite.expires_at) < new Date()) {
    await serviceClient
      .from('hq_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return fail(410, 'This invitation has expired');
  }

  // Fixed email — reject any substitution attempt.
  if (invite.email !== submittedEmail) {
    return fail(400, 'Email address does not match the invitation');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminHeaders = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  // Email uniqueness — reject if an auth user already exists for this email.
  const listRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(invite.email)}`,
    { headers: adminHeaders },
  );
  const listBody = await listRes.json() as { users?: Array<{ email: string }> };
  if ((listBody.users ?? []).some((u) => u.email === invite.email)) {
    return fail(409, `An account with ${invite.email} already exists`);
  }

  // Create auth user.
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { app_role: 'super_admin', name: name.trim() },
    }),
  });
  const createBody = await createRes.json() as { id?: string; error?: string; msg?: string };

  if (!createRes.ok || !createBody.id) {
    return fail(500, createBody.error ?? createBody.msg ?? 'Failed to create auth user');
  }

  const userId = createBody.id;

  // Insert super_admins row.
  const { error: saError } = await serviceClient
    .from('super_admins')
    .insert({ user_id: userId, name: name.trim(), email: invite.email });

  if (saError) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    return fail(500, `Failed to create super admin record: ${saError.message}`);
  }

  // Mark invite as claimed — single-use enforcement.
  await serviceClient
    .from('hq_invites')
    .update({ status: 'claimed', claimed_at: new Date().toISOString(), claimed_by_user_id: userId })
    .eq('id', invite.id);

  // Audit log.
  await serviceClient
    .from('hq_audit_log')
    .insert({
      actor_user_id: userId,
      action: 'claim',
      target_email: invite.email,
      ip,
      metadata: { name: name.trim(), invite_id: invite.id },
    })
    .then(undefined, (e: unknown) =>
      console.error('[auth/claim] audit log failed:', e),
    );

  return NextResponse.json({ ok: true });
}
