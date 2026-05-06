/**
 * Bookings API helpers.
 *
 * Thin Supabase select wrappers used by the Book tab. Tenant scoping is
 * enforced by RLS (see `session_types_select_tenant` in
 * `20260505050000_v03_bookings_schema.sql`), so we don't need to filter by
 * tenant_id client-side — the policy will only return rows the caller can see.
 */

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/database';

export type SessionType = Tables<'session_types'>;
export type CoachAvailability = Tables<'coach_availability'>;
export type Location = Tables<'locations'>;
export type Booking = Tables<'bookings'>;
export type Coach = Tables<'coaches'>;
export type BookingInsert = TablesInsert<'bookings'>;

export async function listSessionTypes(): Promise<SessionType[]> {
  const { data, error } = await supabase
    .from('session_types')
    .select('*')
    .eq('is_active', true)
    .order('type_category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all coach_availability rows the caller can see (RLS scopes by tenant).
 * Returns recurring weekly windows; one row per coach + day_of_week.
 */
export async function listCoachAvailability(): Promise<CoachAvailability[]> {
  const { data, error } = await supabase
    .from('coach_availability')
    .select('*');
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all bookings whose `scheduled_start` falls within the half-open
 * range `[startISO, endISO)`. Cancelled / no-show rows are excluded since
 * they don't reserve time. Tenant scoping is enforced by RLS.
 */
export async function listDayBookings(
  startISO: string,
  endISO: string,
): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .gte('scheduled_start', startISO)
    .lt('scheduled_start', endISO)
    .not('status', 'in', '("cancelled","no_show")');
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all active coaches the caller can see (RLS scopes by tenant).
 */
export async function listCoaches(): Promise<Coach[]> {
  const { data, error } = await supabase
    .from('coaches')
    .select('*')
    .eq('is_active', true)
    .order('first_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Insert a new booking row. RLS policies in
 * `20260505050000_v03_bookings_schema.sql` (and the harden migration) verify
 * tenant_id, kid_id ownership, and that coach/location/session_type all
 * belong to the same tenant. We pass `status: 'confirmed'` since v0.3 has no
 * payment step.
 */
export async function createBooking(input: BookingInsert): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Booking row enriched with the related kid / coach / location names needed
 * to render a list row. RLS still scopes everything to the caller's tenant.
 */
export type FamilyBooking = Booking & {
  kid: Pick<Tables<'kids'>, 'id' | 'first_name' | 'last_name'> | null;
  coach: Pick<Tables<'coaches'>, 'id' | 'first_name' | 'last_name'> | null;
  location: Pick<Tables<'locations'>, 'id' | 'name'> | null;
  session_type:
    | Pick<Tables<'session_types'>, 'id' | 'name' | 'type_category' | 'duration_minutes'>
    | null;
};

const FAMILY_BOOKING_SELECT =
  'id, tenant_id, location_id, kid_id, coach_id, session_type_id, scheduled_start, scheduled_end, cage_number, status, attended_at, cancelled_at, cancellation_reason, notes, created_at, updated_at, kid:kids(id, first_name, last_name), coach:coaches(id, first_name, last_name), location:locations(id, name), session_type:session_types(id, name, type_category, duration_minutes)';

/**
 * Fetch all bookings for the given kid ids, embedding the kid / coach /
 * location names so the bookings list can render without N+1 follow-ups.
 * Sorted newest scheduled_start first; the caller splits into upcoming/past.
 */
export async function listFamilyBookings(kidIds: string[]): Promise<FamilyBooking[]> {
  if (kidIds.length === 0) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select(FAMILY_BOOKING_SELECT)
    .in('kid_id', kidIds)
    .order('scheduled_start', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FamilyBooking[];
}

/**
 * Fetch a single booking by id with the same embeds used by the list, so the
 * detail screen can render without depending on cached list rows. RLS scopes
 * the query to the caller's tenant + own family.
 */
export async function getFamilyBookingById(id: string): Promise<FamilyBooking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(FAMILY_BOOKING_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as FamilyBooking) ?? null;
}

/**
 * Cancel a booking by setting status='cancelled', cancelled_at=now(), and
 * (optionally) cancellation_reason. RLS's `bookings_update_own_family` policy
 * gates this to the parent of the kid on the booking; coaches don't have an
 * UPDATE policy on the table.
 *
 * Note: this is a soft cancel — the row is preserved for history and shows
 * up in the Past section of BookingsListScreen with a "Cancelled" badge.
 */
export async function cancelBooking(
  bookingId: string,
  reason?: string,
): Promise<Booking> {
  const trimmed = reason?.trim();
  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: trimmed && trimmed.length > 0 ? trimmed : null,
    })
    .eq('id', bookingId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch all locations the caller can see (RLS scopes by tenant). Sorted by
 * name so the AddKid picker matches the trigger's "first alphabetically"
 * default ordering.
 */
export async function listTenantLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLocationById(id: string): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
