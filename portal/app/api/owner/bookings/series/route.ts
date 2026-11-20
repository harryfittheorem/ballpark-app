import { NextResponse } from 'next/server';
import { requireSchedulingLocation } from '@/lib/scheduling';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { kid_id, location_id, session_type_id, scheduled_starts } = body;
  if (![kid_id, location_id, session_type_id].every(v => typeof v === 'string' && v.length > 0)
    || !Array.isArray(scheduled_starts) || scheduled_starts.length < 2 || scheduled_starts.length > 52
    || scheduled_starts.some(v => typeof v !== 'string' || !Number.isFinite(Date.parse(v)))) {
    return NextResponse.json({ error: 'Select an existing athlete, location, session type and 2–52 valid occurrence dates.' }, { status: 400 });
  }
  try {
    const { client } = await requireSchedulingLocation(location_id);
    const { data, error } = await client.rpc('create_staff_booking_series', {
      p_kid_id: kid_id, p_location_id: location_id, p_session_type_id: session_type_id,
      p_starts: scheduled_starts.map((v: string) => new Date(v).toISOString()),
      p_cage_number: body.cage_number == null ? null : String(body.cage_number),
      p_notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null,
      p_request_id: body.request_id || req.headers.get('Idempotency-Key') || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, series: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Not authorized.' }, { status: 403 });
  }
}
