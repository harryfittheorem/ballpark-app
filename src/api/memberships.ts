/**
 * Memberships API helpers.
 *
 * Thin wrappers around the memberships table and session-credit RPCs.
 * RLS restricts parents to their own family's memberships via the
 * `memberships_parent_select` policy added in migration
 * 20260602000010_session_packs_credit_tracking.sql.
 *
 * The session-credit RPCs are called via the untyped client because they are
 * not yet in the generated database.ts types. This is the established project
 * pattern for post-regen RPCs — see replit.md "Generated types caveat".
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type ActiveMembership = {
  id: string;
  plan_name: string;
  plan_type: 'eft' | 'otc';
  status: string;
  sessions_total: number | null;
  sessions_remaining: number | null;
  started_at: string;
};

const untypedClient = supabase as unknown as SupabaseClient;

/**
 * Fetch the most-recent active membership for the given kid + tenant.
 * Returns null if the kid has no active membership.
 */
export async function getActiveMembership(
  kidId: string,
  tenantId: string,
): Promise<ActiveMembership | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, plan_name, plan_type, status, sessions_total, sessions_remaining, started_at')
    .eq('kid_id', kidId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ActiveMembership | null;
}

/**
 * Pre-booking check: returns the number of sessions remaining for the kid's
 * active OTC pack, or -1 if the kid has no tracked OTC membership (EFT
 * unlimited counts as -1 = no restriction).
 *
 * Call this BEFORE inserting the booking to give the user a clear
 * error before hitting the DB.  The real race-condition guard lives in
 * `deduct_session_credit` (uses FOR UPDATE).
 */
export async function checkSessionCredits(
  kidId: string,
  tenantId: string,
): Promise<number> {
  const { data, error } = await untypedClient.rpc('check_session_credits', {
    p_kid_id: kidId,
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : -1;
}

/**
 * Atomically decrement the kid's session credit by 1.
 * Returns the new (post-decrement) balance, or -1 for unlimited.
 * Throws if sessions_remaining is already 0.
 */
export async function deductSessionCredit(bookingId: string): Promise<number> {
  const { data, error } = await untypedClient.rpc('deduct_session_credit', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : -1;
}

/**
 * Atomically decrement the kid's session credits by N (for Bring-a-Friend).
 * Returns the new (post-decrement) balance, or -1 for unlimited/untracked.
 * Throws 'no_session_credits' if remaining < n.
 */
export async function deductSessionCredits(kidId: string, n: number): Promise<number> {
  const { data, error } = await untypedClient.rpc('deduct_session_credits', {
    p_kid_id: kidId,
    p_n: n,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : -1;
}

/**
 * Restore one session credit when a future-dated booking is cancelled.
 * Returns the new balance, or -1 for unlimited/untracked memberships,
 * or -2 if the credit was already restored (idempotent no-op).
 */
export async function restoreSessionCredit(bookingId: string): Promise<number> {
  const { data, error } = await untypedClient.rpc('restore_session_credit', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : -1;
}

/**
 * Atomically book a primary session + a guest (Bring-a-Friend) in one
 * database transaction:
 *   1. Deduct 2 credits (FOR UPDATE lock)
 *   2. Insert primary booking row (is_guest = false)
 *   3. Insert guest booking row  (is_guest = true)
 *   4. Insert points_ledger +100, reason = 'bring_a_friend'
 *
 * Returns { primary_booking_id, guest_booking_id, sessions_remaining }.
 * Throws 'no_session_credits' if balance < 2.
 */
export type BookWithFriendResult = {
  primary_booking_id: string;
  guest_booking_id: string;
  sessions_remaining: number;
};

export async function bookSessionWithFriend(params: {
  tenant_id: string;
  location_id: string;
  kid_id: string;
  coach_id: string;
  session_type_id: string;
  scheduled_start: string;
  scheduled_end: string;
  guest_name: string;
  guest_phone?: string | null;
  guest_email?: string | null;
}): Promise<BookWithFriendResult> {
  const { data, error } = await untypedClient.rpc('book_session_with_friend', {
    p_tenant_id:        params.tenant_id,
    p_location_id:      params.location_id,
    p_kid_id:           params.kid_id,
    p_coach_id:         params.coach_id,
    p_session_type_id:  params.session_type_id,
    p_scheduled_start:  params.scheduled_start,
    p_scheduled_end:    params.scheduled_end,
    p_guest_name:       params.guest_name,
    p_guest_phone:      params.guest_phone ?? null,
    p_guest_email:      params.guest_email ?? null,
  });
  if (error) throw error;
  const row = data as { primary_booking_id: string; guest_booking_id: string; sessions_remaining: number };
  return {
    primary_booking_id: row.primary_booking_id,
    guest_booking_id:   row.guest_booking_id,
    sessions_remaining: typeof row.sessions_remaining === 'number' ? row.sessions_remaining : -1,
  };
}

/**
 * Award 100 bonus points to the kid for using Bring-a-Friend.
 * Writes a points_ledger row with reason 'bring_a_friend'.
 */
export async function addBringAFriendPoints(
  kidId: string,
  tenantId: string,
): Promise<void> {
  const { error } = await (supabase as unknown as SupabaseClient)
    .from('points_ledger')
    .insert({
      kid_id: kidId,
      tenant_id: tenantId,
      delta: 100,
      reason: 'bring_a_friend',
    });
  if (error) throw error;
}
