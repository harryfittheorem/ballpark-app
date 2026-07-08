/**
 * POST /api/owner/memberships/[id]/reset-failure-count
 *
 * Staff manual override: resets payment_failure_count to 0, clears
 * payment_pause_scheduled_at and payment_failed_at, and persists an
 * optional staff note to membership_admin_events for audit purposes.
 * Does NOT touch Stripe — use this when payment was arranged in person
 * or outside the normal billing flow.
 *
 * Body: { note?: string }
 * Auth: owner or admin role required.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: membershipId } = await params;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  let body: { note?: string } = {};
  try { body = await req.json() as { note?: string }; } catch { /* empty body ok */ }

  const serviceClient = createServiceClient();

  const { data: mem, error: memErr } = await serviceClient
    .from('memberships')
    .select('id, tenant_id, payment_failure_count, status')
    .eq('id', membershipId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (memErr || !mem) return err(404, 'Membership not found');

  const { error: updateErr } = await serviceClient
    .from('memberships')
    .update({
      payment_failure_count:      0,
      payment_pause_scheduled_at: null,
      payment_failed_at:          null,
      updated_at:                 new Date().toISOString(),
    })
    .eq('id', membershipId)
    .eq('tenant_id', tenantId);

  if (updateErr) return err(500, updateErr.message);

  const staffEmail = session.user.email ?? 'staff';
  const note = body.note?.trim() ?? '';

  // Persist audit record to membership_admin_events for durable recordkeeping.
  const { error: auditErr } = await serviceClient
    .from('membership_admin_events')
    .insert({
      tenant_id:     tenantId,
      membership_id: membershipId,
      event_type:    'reset_failure_count',
      note:          note || null,
      created_by:    staffEmail,
    });

  if (auditErr) {
    // Log but don't block the response — the reset itself succeeded.
    console.error(`[reset-failure-count] audit insert failed membership=${membershipId}:`, auditErr.message);
  }

  console.log(
    `[reset-failure-count] membership=${membershipId} by=${staffEmail} prev_count=${mem.payment_failure_count}${note ? ` note="${note}"` : ''}`,
  );

  return NextResponse.json({ ok: true, previous_count: mem.payment_failure_count });
}
