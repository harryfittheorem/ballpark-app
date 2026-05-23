/**
 * PATCH /api/memberships/sessions
 *
 * Owner / admin-only endpoint to manually override the `sessions_remaining`
 * field on an OTC membership.  Used from the portal member detail page for
 * staff adjustments (e.g. gifting sessions, correcting data entry errors).
 *
 * Auth flow:
 *  1. Verify the caller's session and confirm app_role ∈ {owner, admin, super_admin}
 *  2. Confirm the membership belongs to the caller's tenant
 *  3. Perform the write via the service-role client to bypass RLS
 *     (memberships has no UPDATE policy for authenticated users by design;
 *      all writes go through SECURITY DEFINER RPCs or service-role paths)
 *
 * Body: { membership_id: string; sessions_remaining: number }
 * Returns: { ok: true; sessions_remaining: number }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId, readAppRole } from '@/lib/auth';

const ALLOWED_ROLES = new Set(['owner', 'admin', 'super_admin']);

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as { membership_id?: string; sessions_remaining?: number };
    const { membership_id, sessions_remaining } = body;

    if (!membership_id || typeof sessions_remaining !== 'number' || sessions_remaining < 0) {
      return NextResponse.json(
        { error: 'membership_id and non-negative sessions_remaining are required.' },
        { status: 400 },
      );
    }

    // ── Identity & role check (user-auth client, subject to RLS) ──────────
    const userClient = await createClient();
    const { data: { session } } = await userClient.auth.getSession();

    const appRole = readAppRole(session);
    if (!ALLOWED_ROLES.has(appRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = readTenantId(session);
    if (!tenantId && appRole !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Validate tenant ownership and OTC type (user-auth client) ─────────
    // The SELECT RLS policy for owner/admin allows reading memberships in
    // their tenant, so this read succeeds without service role.
    const selectQuery = userClient
      .from('memberships')
      .select('id, plan_type, sessions_total, tenant_id')
      .eq('id', membership_id);

    if (tenantId) {
      selectQuery.eq('tenant_id', tenantId);
    }

    const { data: mem, error: fetchErr } = await selectQuery.single();

    if (fetchErr || !mem) {
      return NextResponse.json({ error: 'Membership not found.' }, { status: 404 });
    }

    if (mem.plan_type !== 'otc') {
      return NextResponse.json(
        { error: 'Session credits only apply to OTC (pack) memberships.' },
        { status: 422 },
      );
    }

    const sessionsTotal = (mem.sessions_total as number | null) ?? null;
    if (sessionsTotal !== null && sessions_remaining > sessionsTotal) {
      return NextResponse.json(
        { error: `sessions_remaining cannot exceed sessions_total (${sessionsTotal}).` },
        { status: 422 },
      );
    }

    // ── Write via service-role client (bypasses RLS on memberships) ───────
    const serviceClient = createServiceClient();
    const { error: updateErr } = await serviceClient
      .from('memberships')
      .update({ sessions_remaining, updated_at: new Date().toISOString() })
      .eq('id', membership_id)
      .eq('tenant_id', mem.tenant_id as string);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sessions_remaining });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
