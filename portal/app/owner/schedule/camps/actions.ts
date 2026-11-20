'use server';

import { requireSchedulingLocation, schedulingActor } from '@/lib/scheduling';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function fetchCampEvents(locationId: string) {
  const { client, tenantId } = await requireSchedulingLocation(locationId, true);
  const { data, error } = await client.from('camp_events')
    .select('id, name, offering_category, capacity, status, version, session_type_id, sales_enabled, camp_event_days(id, day_number, starts_at, ends_at, cage_number), camp_enrollments(count)')
    .eq('tenant_id', tenantId).eq('location_id', locationId).order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Camp events could not be loaded.');
  return (data ?? []).map(event => ({
    ...event,
    camp_event_days: (event.camp_event_days ?? []).sort((a, b) => a.day_number - b.day_number),
    enrolled: one(event.camp_enrollments)?.count ?? 0,
  }));
}

export async function fetchCampRoster(eventId: string) {
  const { client, tenantId } = await schedulingActor();
  const { data: event, error: eventError } = await client.from('camp_events')
    .select('location_id').eq('tenant_id', tenantId).eq('id', eventId).maybeSingle();
  if (eventError || !event) throw new Error('Camp event unavailable.');
  await requireSchedulingLocation(event.location_id, true);
  const { data, error } = await client.from('camp_roster_entries')
    .select('booking_id, camp_enrollments!inner(event_id, kids(first_name, last_name)), camp_event_days(day_number, starts_at, ends_at), bookings(status, attended_at)')
    .eq('tenant_id', tenantId).eq('location_id', event.location_id).eq('camp_enrollments.event_id', eventId);
  if (error) throw new Error('Camp roster could not be loaded.');
  return (data ?? []).map(row => {
    const enrollment = one(row.camp_enrollments);
    const kid = one(enrollment?.kids);
    const day = one(row.camp_event_days);
    const booking = one(row.bookings);
    return {
      id: row.booking_id, name: [kid?.first_name, kid?.last_name].filter(Boolean).join(' ') || 'Unknown athlete',
      day: day?.day_number ?? 0, startsAt: day?.starts_at ?? '', endsAt: day?.ends_at ?? '',
      status: booking?.status ?? 'unavailable', attendedAt: booking?.attended_at ?? null,
    };
  }).sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

export type CampDraftInput = {
  eventId: string | null; locationId: string; name: string; category: 'camp' | 'clinic';
  sessionTypeId: string; capacity: number; expectedVersion: number | null;
  days: { starts_at: string; ends_at: string; cage_number: string | null }[];
  requestId: string;
};
type Result = { ok: true; id?: string } | { ok: false; error: string };

function campError(message: string) {
  if (message.includes('camp_draft_changed_refresh_required')) return 'Another staff member changed this draft. Reload it before editing.';
  if (message.includes('camp_schedule_locked')) return 'This event is archived, ready for sale, or has a confirmed purchase. Schedule changes and cancellation need a separate approved workflow.';
  if (message.includes('camp_instruction_resource_required')) return 'Each assigned cage must be an active instruction or shared resource at this location.';
  if (message.includes('event_days_must_be_future_ordered_and_nonoverlapping')) return 'Event windows must be future dates in order, without overlaps.';
  if (message.includes('idempotency_key_reused')) return 'This retry key belongs to another change. Close and reopen the draft.';
  return 'The camp draft could not be saved.';
}

export async function saveCampDraft(input: CampDraftInput): Promise<Result> {
  try {
    const { client } = await requireSchedulingLocation(input.locationId);
    if (!input.name.trim() || input.name.length > 120 || !['camp', 'clinic'].includes(input.category)
      || !Number.isSafeInteger(input.capacity) || input.capacity < 1 || input.capacity > 2147483647
      || !Array.isArray(input.days) || input.days.length < 1 || input.days.length > 60
      || input.days.some(day => !Number.isFinite(Date.parse(day.starts_at)) || !Number.isFinite(Date.parse(day.ends_at)))) {
      return { ok: false, error: 'Enter an event name, category, positive capacity and 1–60 valid day windows.' };
    }
    const { data, error } = await client.rpc('save_camp_draft', {
      p_event_id: input.eventId, p_location_id: input.locationId, p_name: input.name.trim(), p_category: input.category,
      p_session_type_id: input.sessionTypeId, p_capacity: input.capacity, p_days: input.days,
      p_request_id: input.requestId, p_expected_version: input.expectedVersion,
    });
    return error ? { ok: false, error: campError(error.message) } : { ok: true, id: data };
  } catch { return { ok: false, error: 'Not authorized, or the draft could not be saved.' }; }
}

export async function archiveCampDraft(eventId: string): Promise<Result> {
  try {
    const { client } = await schedulingActor();
    const { error } = await client.rpc('archive_camp_draft', { p_event_id: eventId });
    return error ? { ok: false, error: campError(error.message) } : { ok: true };
  } catch { return { ok: false, error: 'The draft could not be archived.' }; }
}
