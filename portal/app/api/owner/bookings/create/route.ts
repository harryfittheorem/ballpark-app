import { NextResponse } from 'next/server';
import { requireSchedulingLocation } from '@/lib/scheduling';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { kid_id, session_type_id, location_id, scheduled_start, scheduled_end } = body;
  if (body.walk_in !== undefined && typeof body.walk_in !== 'boolean') {
    return NextResponse.json({ error: 'Invalid walk-in option.' }, { status: 400 });
  }
  const walkIn = body.walk_in === true;
  if (![kid_id, session_type_id, location_id, ...(!walkIn ? [scheduled_start, scheduled_end] : [])].every(v => typeof v === 'string' && v.length > 0)) {
    return NextResponse.json({ error: 'Athlete, session type, location and dates are required.' }, { status: 400 });
  }
  const start = Date.parse(scheduled_start), end = Date.parse(scheduled_end);
  if (!walkIn && (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)) {
    return NextResponse.json({ error: 'Choose a valid start and end time.' }, { status: 422 });
  }
  try {
    const { client } = await requireSchedulingLocation(location_id);
    const sharedParams = {
      p_kid_id: kid_id, p_location_id: location_id, p_session_type_id: session_type_id,
      p_cage_number: body.cage_number == null ? null : String(body.cage_number),
      p_notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null,
      p_request_id: body.request_id || req.headers.get('Idempotency-Key') || null,
    };
    const { data, error } = walkIn
      ? await client.rpc('create_staff_walkin', sharedParams)
      : await client.rpc('create_staff_booking', {
        ...sharedParams, p_coach_id: body.coach_id || null,
        p_scheduled_start: new Date(start).toISOString(), p_scheduled_end: new Date(end).toISOString(),
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, booking: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Not authorized.' }, { status: 403 });
  }
}
