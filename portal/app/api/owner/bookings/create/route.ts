/**
 * POST /api/owner/bookings/create
 *
 * Staff action: create a real booking from the owner portal (reused by the
 * member detail page's "Book Session" button — same shape as the Schedule
 * page's New Booking modal, but this is the first route that actually
 * persists a booking row; the Schedule modal today only updates local state).
 *
 * Body: {
 *   kid_id: string
 *   coach_id: string
 *   session_type_id: string
 *   location_id: string
 *   scheduled_start: string (ISO)
 *   scheduled_end: string (ISO)
 *   cage_number?: number | null
 *   notes?: string | null
 * }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
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
    kid_id?: string;
    coach_id?: string;
    session_type_id?: string;
    location_id?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    cage_number?: number | null;
    notes?: string | null;
  };

  const { kid_id, coach_id, session_type_id, location_id, scheduled_start, scheduled_end } = body;

  if (!kid_id || !coach_id || !session_type_id || !location_id || !scheduled_start || !scheduled_end) {
    return clientErr(400, 'kid_id, coach_id, session_type_id, location_id, scheduled_start, and scheduled_end are required');
  }

  const start = new Date(scheduled_start);
  const end = new Date(scheduled_end);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return clientErr(422, 'scheduled_end must be a valid date after scheduled_start');
  }

  const supabase = createServiceClient();

  const [kidRes, coachRes, sessionTypeRes, locationRes] = await Promise.all([
    supabase.from('kids').select('id').eq('id', kid_id).eq('tenant_id', tenantId).single(),
    supabase.from('coaches').select('id').eq('id', coach_id).eq('tenant_id', tenantId).single(),
    supabase.from('session_types').select('id').eq('id', session_type_id).eq('tenant_id', tenantId).single(),
    supabase.from('locations').select('id').eq('id', location_id).eq('tenant_id', tenantId).single(),
  ]);

  if (kidRes.error || !kidRes.data) return clientErr(404, 'Kid not found for this tenant');
  if (coachRes.error || !coachRes.data) return clientErr(404, 'Coach not found for this tenant');
  if (sessionTypeRes.error || !sessionTypeRes.data) return clientErr(404, 'Session type not found for this tenant');
  if (locationRes.error || !locationRes.data) return clientErr(404, 'Location not found for this tenant');

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      location_id,
      kid_id,
      coach_id,
      session_type_id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      cage_number: body.cage_number != null ? String(body.cage_number) : null,
      notes: body.notes?.trim() || null,
      status: 'confirmed',
    })
    .select('id, scheduled_start, scheduled_end, status')
    .single();

  if (error) return clientErr(500, `Failed to create booking: ${error.message}`);

  return NextResponse.json({ ok: true, booking: data });
}
