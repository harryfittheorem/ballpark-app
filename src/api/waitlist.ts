/**
 * Waitlist API helpers.
 *
 * All RPCs are SECURITY DEFINER; the caller only needs to be authenticated.
 * Slot-level capacity counts use get_day_slot_availability (SECURITY DEFINER
 * so it can see all families' bookings).
 */

import { supabase } from '@/lib/supabase';

export type WaitlistEntry = {
  id: string;
  tenant_id: string;
  session_slot_key: string;
  kid_id: string;
  family_id: string;
  coach_id: string;
  session_type_id: string;
  location_id: string;
  scheduled_start: string;
  scheduled_end: string;
  position: number;
  status: 'waiting' | 'notified' | 'claimed' | 'expired' | 'cancelled';
  notified_at: string | null;
  claim_deadline: string | null;
  created_at: string;
  updated_at: string;
};

export type WaitlistEntryRich = WaitlistEntry & {
  kid: { id: string; first_name: string; last_name: string } | null;
  coach: { id: string; first_name: string; last_name: string } | null;
  location: { id: string; name: string } | null;
  session_type: { id: string; name: string; type_category: string; duration_minutes: number } | null;
};

export type SlotAvailability = {
  session_slot_key: string;
  confirmed_count: number;
  waitlist_count: number;
  capacity: number;
};

export type JoinWaitlistResult = WaitlistEntry;

export type ClaimResult =
  | { code: 'OK'; booking_id: string }
  | { code: 'CLAIM_EXPIRED' }
  | { code: 'NOT_FOUND' };

const WAITLIST_RICH_SELECT =
  'id, tenant_id, session_slot_key, kid_id, family_id, coach_id, session_type_id, location_id, scheduled_start, scheduled_end, position, status, notified_at, claim_deadline, created_at, updated_at, kid:kids(id, first_name, last_name), coach:coaches(id, first_name, last_name), location:locations(id, name), session_type:session_types(id, name, type_category, duration_minutes)';

/**
 * Join the waitlist for a slot. Idempotent — returns the existing entry if
 * already queued (status = waiting | notified).
 */
export async function joinWaitlist(params: {
  session_slot_key: string;
  coach_id: string;
  session_type_id: string;
  location_id: string;
  scheduled_start: string;
  scheduled_end: string;
}): Promise<JoinWaitlistResult> {
  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  ).rpc('join_waitlist', {
    p_session_slot_key: params.session_slot_key,
    p_coach_id: params.coach_id,
    p_session_type_id: params.session_type_id,
    p_location_id: params.location_id,
    p_scheduled_start: params.scheduled_start,
    p_scheduled_end: params.scheduled_end,
  });
  if (error) throw error;
  return data as JoinWaitlistResult;
}

/**
 * Leave the waitlist. Sets status='cancelled' and re-numbers remaining positions.
 */
export async function leaveWaitlist(waitlistId: string): Promise<void> {
  const { error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  ).rpc('leave_waitlist', { p_waitlist_id: waitlistId });
  if (error) throw error;
}

/**
 * Claim a spot that was offered via push notification. Returns CLAIM_EXPIRED if
 * the 2-hour window has passed, NOT_FOUND if the entry no longer exists in
 * 'notified' status, OK + booking_id on success.
 */
export async function claimWaitlistSpot(waitlistId: string): Promise<ClaimResult> {
  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  ).rpc('claim_waitlist_spot', { p_waitlist_id: waitlistId });
  if (error) throw error;
  return data as ClaimResult;
}

/**
 * Fetch all active (waiting | notified) + recently claimed waitlist entries
 * for the authenticated family, with embedded kid/coach/location/session_type.
 */
export async function listFamilyWaitlistEntries(): Promise<WaitlistEntryRich[]> {
  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  )
    .from('booking_waitlist')
    .select(WAITLIST_RICH_SELECT)
    .in('status', ['waiting', 'notified'])
    .order('scheduled_start', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as WaitlistEntryRich[];
}

/**
 * Get slot capacity counts for a day + session type. Used by the Book tab to
 * show "Join Waitlist" on full slots.
 *
 * Returns a map of session_slot_key → SlotAvailability.
 */
export async function getDaySlotAvailability(params: {
  tenant_id: string;
  session_type_id: string;
  start: string;
  end: string;
}): Promise<Map<string, SlotAvailability>> {
  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  ).rpc('get_day_slot_availability', {
    p_tenant_id: params.tenant_id,
    p_session_type_id: params.session_type_id,
    p_start: params.start,
    p_end: params.end,
  });
  if (error) throw error;
  const map = new Map<string, SlotAvailability>();
  for (const row of (data ?? []) as SlotAvailability[]) {
    map.set(row.session_slot_key, row);
  }
  return map;
}
