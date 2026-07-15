/**
 * POST /api/platform/setup
 *
 * One-time bootstrap: creates the first super admin account.
 * Once platform_init is set this route permanently returns 409.
 *
 * Security guarantees:
 *  - IP-based rate limiting (5 req / 15 min)
 *  - Server-side platform_init check (also checked in the page)
 *  - Atomic INSERT INTO platform_init with unique-id constraint as DB lock
 *  - Losing concurrent request cleans up its orphaned auth user
 *  - Audit log on success
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`platform-setup:${ip}`, 5, 15 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    email?: string;
    password?: string;
  };

  const { name, email, password } = body;
  if (!name?.trim() || !email?.trim() || !password) {
    return fail(400, 'name, email and password are required');
  }
  if (password.length < 8) {
    return fail(400, 'Password must be at least 8 characters');
  }

  const serviceClient = createServiceClient();

  // Server-side guard — the page also checks, but we double-check here.
  const { data: existingInit } = await serviceClient
    .from('platform_init')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existingInit) {
    return fail(409, 'Platform is already initialized');
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

  // Create auth user (email pre-confirmed — no email loop for the bootstrap admin).
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { app_role: 'super_admin', name },
    }),
  });
  const createBody = await createRes.json() as { id?: string; error?: string; msg?: string };

  if (!createRes.ok || !createBody.id) {
    return fail(500, createBody.error ?? createBody.msg ?? 'Failed to create auth user');
  }

  const userId = createBody.id;

  // ── Atomic lock ──────────────────────────────────────────────────────────
  // INSERT INTO platform_init with id=1 (unique constraint).
  // If two concurrent requests race, exactly one INSERT wins; the other
  // gets a unique-violation error and cleans up its newly-created auth user.
  const { error: initError } = await serviceClient
    .from('platform_init')
    .insert({ id: 1, initialized_by_user_id: userId });

  if (initError) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    return fail(409, 'Platform was just initialized by another request');
  }

  // Create super_admins row — if this fails, compensate (delete auth user).
  const { error: saError } = await serviceClient
    .from('super_admins')
    .insert({ user_id: userId, name: name.trim(), email });

  if (saError) {
    // Compensate: delete auth user AND remove the platform_init row so the
    // bootstrap page re-opens and the operator can try again.
    await Promise.allSettled([
      fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: adminHeaders,
      }),
      serviceClient.from('platform_init').delete().eq('id', 1),
    ]);
    return fail(500, `Failed to create super admin record: ${saError.message}`);
  }

  // Audit log — best-effort.
  await serviceClient
    .from('hq_audit_log')
    .insert({
      actor_user_id: userId,
      action: 'bootstrap',
      target_email: email,
      ip,
      metadata: { name: name.trim() },
    })
    .then(undefined, (e: unknown) =>
      console.error('[platform/setup] audit log insert failed:', e),
    );

  return NextResponse.json({ ok: true });
}
