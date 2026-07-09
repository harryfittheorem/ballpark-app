/**
 * PATCH /api/owner/memberships/[id]/update
 *
 * Staff action: edit a member's editable fields from the member detail
 * page — parent contact info (families table) and the membership's plan
 * name (memberships.plan_name). Tenant-pinned via service client + JWT
 * tenant claim, mirroring the billing-date route's auth pattern.
 *
 * Body: {
 *   parent_first_name?: string
 *   parent_last_name?: string | null
 *   parent_email?: string
 *   parent_phone?: string | null
 *   plan_name?: string
 * }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: membershipId } = await params;
  if (!membershipId) return clientErr(400, 'Missing membership id');

  const userClient = await createClient();
  const { data: { session } } = await userClient.auth.getSession();
  if (!session) return clientErr(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin' && role !== 'super_admin') {
    return clientErr(403, 'Forbidden');
  }

  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  if (!tenantId) return clientErr(403, 'No tenant in token — re-authenticate');

  const body = await req.json().catch(() => ({})) as {
    parent_first_name?: unknown;
    parent_last_name?: unknown;
    parent_email?: unknown;
    parent_phone?: unknown;
    plan_name?: unknown;
  };

  const supabase = createServiceClient();

  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select('id, family_id, plan_name')
    .eq('id', membershipId)
    .eq('tenant_id', tenantId)
    .single();

  if (memErr || !mem) return clientErr(404, 'Membership not found or access denied');

  const familyUpdate: Record<string, string | null> = {};
  if (typeof body.parent_first_name === 'string' && body.parent_first_name.trim()) {
    familyUpdate.parent_first_name = body.parent_first_name.trim();
  }
  if (typeof body.parent_last_name === 'string' || body.parent_last_name === null) {
    familyUpdate.parent_last_name = typeof body.parent_last_name === 'string'
      ? body.parent_last_name.trim() || null
      : null;
  }
  if (typeof body.parent_email === 'string' && body.parent_email.trim()) {
    if (!/^\S+@\S+\.\S+$/.test(body.parent_email.trim())) {
      return clientErr(422, 'Invalid email address');
    }
    familyUpdate.parent_email = body.parent_email.trim();
  }
  if (typeof body.parent_phone === 'string' || body.parent_phone === null) {
    familyUpdate.parent_phone = typeof body.parent_phone === 'string'
      ? body.parent_phone.trim() || null
      : null;
  }

  if (Object.keys(familyUpdate).length > 0) {
    const { error: famErr } = await supabase
      .from('families')
      .update(familyUpdate)
      .eq('id', mem.family_id)
      .eq('tenant_id', tenantId);
    if (famErr) return clientErr(500, `Failed to update contact info: ${famErr.message}`);
  }

  if (typeof body.plan_name === 'string' && body.plan_name.trim() && body.plan_name.trim() !== mem.plan_name) {
    const { error: planErr } = await supabase
      .from('memberships')
      .update({ plan_name: body.plan_name.trim(), updated_at: new Date().toISOString() })
      .eq('id', membershipId)
      .eq('tenant_id', tenantId);
    if (planErr) return clientErr(500, `Failed to update program: ${planErr.message}`);
  }

  return NextResponse.json({ ok: true });
}
