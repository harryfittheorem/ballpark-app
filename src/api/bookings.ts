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
 * Fetch coach_availability rows the caller can see (RLS scopes by tenant).
 * Returns recurring weekly windows; one row per coach + day_of_week.
 *
 * When `locationId` is provided, only returns availability for coaches that
 * are assigned to that location via the `coach_locations` junction table.
 * coach_availability has no location_id column, so we resolve the coach
 * set first, then filter availability by coach_id.
 *
 * coach_locations is a Phase 2 table not yet in generated database.ts types;
 * the untyped client is used for that query only.
 */
export async function listCoachAvailability(
  locationId?: string | null,
): Promise<CoachAvailability[]> {
  if (locationId) {
    // Resolve which coach_ids are assigned to this location.
    const { data: coachLocs, error: clErr } = await (
      supabase as unknown as import('@supabase/supabase-js').SupabaseClient
    )
      .from('coach_locations')
      .select('coach_id')
      .eq('location_id', locationId);
    if (clErr) throw clErr;

    const coachIds: string[] = (coachLocs ?? []).map(
      (r: { coach_id: string }) => r.coach_id,
    );
    if (coachIds.length === 0) return [];

    const { data, error } = await supabase
      .from('coach_availability')
      .select('*')
      .in('coach_id', coachIds);
    if (error) throw error;
    return data ?? [];
  }

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
 * Fetch active coaches the caller can see (RLS scopes by tenant).
 *
 * When `locationId` is provided, only coaches assigned to that location via
 * the `coach_locations` junction table are returned. A coach is visible at a
 * location regardless of which location is their primary — any assignment row
 * in coach_locations qualifies.
 *
 * coach_locations is a Phase 2 table not yet in generated database.ts types;
 * the untyped client is used for that query only.
 */
export async function listCoaches(locationId?: string | null): Promise<Coach[]> {
  if (locationId) {
    const { data: coachLocs, error: clErr } = await (
      supabase as unknown as import('@supabase/supabase-js').SupabaseClient
    )
      .from('coach_locations')
      .select('coach_id')
      .eq('location_id', locationId);
    if (clErr) throw clErr;

    const coachIds: string[] = (coachLocs ?? []).map(
      (r: { coach_id: string }) => r.coach_id,
    );
    if (coachIds.length === 0) return [];

    const { data, error } = await supabase
      .from('coaches')
      .select('*')
      .eq('is_active', true)
      .in('id', coachIds)
      .order('first_name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

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
  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  )
    .from('bookings')
    .select(FAMILY_BOOKING_SELECT)
    .in('kid_id', kidIds)
    .eq('is_guest', false)
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
 * Cancel a booking via the `cancel_booking` SECURITY DEFINER RPC.
 * The RPC enforces cancellation-window policy and returns a `LATE_CANCEL`
 * code when the booking is inside the tenant's configured window without
 * override. Pass `override = true` to bypass the window check (staff only).
 *
 * Returns:
 *   { ok: true }  — booking cancelled successfully
 *   { code: 'LATE_CANCEL', fee_cents: N, window_hours: N }  — inside window
 *   throws on DB/network error
 */
export type CancelBookingResult =
  | { ok: true }
  | { code: 'LATE_CANCEL'; fee_cents: number; window_hours: number; message: string }
  | { code: 'NOT_FOUND' | 'ALREADY_CANCELLED'; message: string };

export async function cancelBookingRpc(
  bookingId: string,
  reason?: string,
  override = false,
): Promise<CancelBookingResult> {
  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  ).rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason?.trim() || null,
    p_override: override,
  });
  if (error) throw error;
  return data as CancelBookingResult;
}

/**
 * @deprecated Use cancelBookingRpc instead. This direct-table cancel is kept
 * for backward compatibility but does not enforce cancellation-window policy.
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
 * Cancel a membership via the `cancel_membership` SECURITY DEFINER RPC.
 * Sets cancel_requested_at + cancel_effective_at (≥ notice_days from now).
 * Does NOT immediately cancel the Stripe subscription.
 *
 * Returns:
 *   { ok: true, cancel_effective_at: ISO string }  — request recorded
 *   { code: 'NOT_EFT' | 'ALREADY_CANCELLED' | 'ALREADY_REQUESTED' | 'NOT_FOUND', message: string }
 */
export type CancelMembershipResult =
  | { ok: true; cancel_effective_at: string }
  | {
      code: 'NOT_EFT' | 'ALREADY_CANCELLED' | 'ALREADY_REQUESTED' | 'NOT_FOUND';
      message: string;
      cancel_effective_at?: string;
    };

export async function cancelMembershipRpc(
  membershipId: string,
  override = false,
): Promise<CancelMembershipResult> {
  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  ).rpc('cancel_membership', {
    p_membership_id: membershipId,
    p_override: override,
  });
  if (error) throw error;
  return data as CancelMembershipResult;
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
