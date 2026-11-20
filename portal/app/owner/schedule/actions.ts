'use server';

import { schedulingActor, requireSchedulingLocation } from '@/lib/scheduling';
import type { ScheduleBooking } from '@/lib/supabase/ownerQueries';

export type FetchScheduleResult = {
  bookings: ScheduleBooking[];
  waitlistByHour: Record<string, number>;
};

function localHourLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

export async function fetchScheduleRange(
  rangeStart: string,
  rangeEnd: string,
): Promise<FetchScheduleResult> {
  const { client: supabase, tenantId } = await schedulingActor();
  const start = Date.parse(rangeStart), end = Date.parse(rangeEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 43 * 86400000) {
    throw new Error('Invalid schedule date range.');
  }
  const { locations } = await getSchedulingOptions();
  const locationIds = locations.map(location => location.id);
  if (locationIds.length === 0) return { bookings: [], waitlistByHour: {} };

  const [bookingRes, waitlistRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, location_id, scheduled_start, scheduled_end, cage_number, status,
        session_types(name),
        kids(first_name, last_name),
        coaches!bookings_coach_id_fkey(first_name, last_name),
        booking_series_occurrences(series_id, occurrence_number),
        camp_roster_entries(enrollment_id, camp_event_days(cage_number, camp_events(name)))
      `)
      .eq('tenant_id', tenantId)
      .in('location_id', locationIds)
      .gte('scheduled_start', rangeStart)
      .lte('scheduled_start', rangeEnd)
      .order('scheduled_start'),
    supabase
      .from('booking_waitlist')
      .select('scheduled_start')
      .eq('tenant_id', tenantId)
      .in('location_id', locationIds)
      .in('status', ['waiting', 'notified'])
      .gte('scheduled_start', rangeStart)
      .lte('scheduled_start', rangeEnd),
  ]);

  if (bookingRes.error) {
    throw new Error(bookingRes.error.message);
  }
  if (waitlistRes.error) throw new Error(waitlistRes.error.message);

  const bookings: ScheduleBooking[] = (bookingRes.data ?? []).map(b => {
    const kid   = b.kids as unknown as { first_name: string; last_name: string | null } | null;
    const coach = b.coaches as unknown as { first_name: string; last_name: string | null } | null;
    const st    = b.session_types as unknown as { name: string } | null;
    const occurrence = (Array.isArray(b.booking_series_occurrences)
      ? b.booking_series_occurrences[0] : b.booking_series_occurrences) as { series_id: string; occurrence_number: number } | null;
    const camp = (Array.isArray(b.camp_roster_entries) ? b.camp_roster_entries[0] : b.camp_roster_entries) as unknown as {
      enrollment_id: string; camp_event_days: { cage_number: string | null; camp_events: { name: string } | { name: string }[] } | { cage_number: string | null; camp_events: { name: string } | { name: string }[] }[];
    } | null;
    const campDay = Array.isArray(camp?.camp_event_days) ? camp.camp_event_days[0] : camp?.camp_event_days;
    const campEvent = Array.isArray(campDay?.camp_events) ? campDay.camp_events[0] : campDay?.camp_events;
    const cage = campDay?.cage_number ?? b.cage_number;
    return {
      id:             b.id,
      seriesId:       occurrence?.series_id,
      occurrenceNumber: occurrence?.occurrence_number,
      isCampBooking: !!camp?.enrollment_id,
      locationId:     b.location_id,
      kidName:        kid   ? [kid.first_name,   kid.last_name].filter(Boolean).join(' ')   : 'Unknown',
      coachName:      coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') : '—',
      scheduledStart: b.scheduled_start,
      scheduledEnd:   b.scheduled_end ?? b.scheduled_start,
      cage:           cage ? `Cage ${cage}` : null,
      sessionType:    campEvent?.name ?? st?.name ?? 'Private',
      status:         b.status,
    };
  });

  const waitlistByHour: Record<string, number> = {};
  for (const row of waitlistRes.data ?? []) {
    const lbl = localHourLabel(row.scheduled_start);
    waitlistByHour[lbl] = (waitlistByHour[lbl] ?? 0) + 1;
  }

  return { bookings, waitlistByHour };
}

export async function assignCageAction(
  bookingId: string,
  cageNumber: string | null,
): Promise<{ error?: string }> {
  try {
    const { client } = await schedulingActor();
    const { error } = await client.rpc('assign_booking_cage', {
      p_booking_id: bookingId, p_cage_number: cageNumber == null ? null : String(cageNumber),
    });
    if (error) throw error;
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Cage assignment failed.' };
  }
}

export async function getSchedulingOptions(initialAthleteId?: string) {
  const { client, tenantId, role } = await schedulingActor();
  const [locations, types, resources, capacities] = await Promise.all([
    client.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    client.from('session_types').select('id, name, type_category, duration_minutes').eq('tenant_id', tenantId).eq('is_active', true).order('name'),
    client.from('scheduling_resources').select('location_id, cage_number, purpose').eq('tenant_id', tenantId).eq('is_active', true),
    client.from('scheduling_location_rules').select('location_id, lesson_capacity, rental_capacity, capacity_source, approved_at').eq('tenant_id', tenantId),
  ]);
  if (locations.error || types.error || resources.error || capacities.error) throw new Error(locations.error?.message ?? types.error?.message ?? resources.error?.message ?? capacities.error?.message);
  // The RPC applies the same location permission check as creation.
  const permitted = await Promise.all((locations.data ?? []).map(async location => {
    const { data, error } = await client.rpc('can_manage_booking_location', { p_tenant_id: tenantId, p_location_id: location.id });
    if (error) throw error;
    return data === true ? location : null;
  }));
  const allowedLocations = permitted.filter((l): l is NonNullable<typeof l> => l !== null);
  let initialAthlete: { id: string; name: string; locationId: string } | null = null;
  if (initialAthleteId) {
    const { data, error } = await client.from('kids')
      .select('id, first_name, last_name, families!inner(tenant_id, primary_location_id)')
      .eq('id', initialAthleteId).eq('families.tenant_id', tenantId).maybeSingle();
    const family = Array.isArray(data?.families) ? data.families[0] : data?.families;
    if (error || !data || !family?.primary_location_id
      || !allowedLocations.some(location => location.id === family.primary_location_id)) {
      throw new Error('This athlete needs a family assignment to an authorized location before booking.');
    }
    initialAthlete = { id: data.id, name: [data.first_name, data.last_name].filter(Boolean).join(' '), locationId: family.primary_location_id };
  }
  return {
    locations: allowedLocations, initialAthlete,
    types: types.data ?? [], resources: resources.data ?? [], capacities: capacities.data ?? [],
    canConfigureCapacity: role === 'owner' || role === 'super_admin',
    canConfigureOverrides: ['owner', 'admin', 'super_admin'].includes(role),
  };
}

export async function saveManualLocationCapacity(locationId: string, lessonCapacity: number, rentalCapacity: number) {
  const { client, role } = await requireSchedulingLocation(locationId);
  if (!['owner', 'super_admin'].includes(role)) throw new Error('Only a tenant owner can configure capacity.');
  if (![lessonCapacity, rentalCapacity].every(n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647)) {
    throw new Error('Enter a positive whole-number limit for lessons and rentals.');
  }
  const { error } = await client.rpc('set_manual_location_capacity', {
    p_location_id: locationId, p_lesson_capacity: lessonCapacity, p_rental_capacity: rentalCapacity,
  });
  if (error?.message.includes('capacity_below_existing_reservations')) {
    throw new Error('These limits are below existing reservations. No bookings were changed. Review the schedule before reducing capacity.');
  }
  if (error) throw new Error(error.message);
}

export async function searchSchedulingAthletes(locationId: string, search: string) {
  const { client, tenantId } = await requireSchedulingLocation(locationId);
  const term = search.trim().replace(/[^a-zA-Z0-9 '\u00C0-\u024F-]/g, '').slice(0, 80);
  if (term.length < 2) return [];
  const { data, error } = await client.from('kids')
    .select('id, first_name, last_name, families!inner(tenant_id, primary_location_id)')
    .eq('families.tenant_id', tenantId)
    .eq('families.primary_location_id', locationId)
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
    .order('first_name').limit(30);
  if (error) throw new Error('Athlete search could not be loaded. Please try again.');
  return (data ?? []).map(k => ({ id: k.id, name: [k.first_name, k.last_name].filter(Boolean).join(' ') }));
}
