/**
 * Memberships API helpers.
 *
 * Thin wrappers around the memberships table and session-credit RPCs.
 * RLS restricts parents to their own family's memberships via the
 * `memberships_parent_select` policy added in migration
 * 20260602000010_session_packs_credit_tracking.sql.
 *
 * The three session-credit RPCs (`check_session_credits`,
 * `deduct_session_credit`, `restore_session_credit`) are called via the
 * untyped client because they are not yet in the generated database.ts types.
 * This is the established project pattern for post-regen RPCs — see replit.md
 * "Generated types caveat".
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
 * Restore one session credit when a future-dated booking is cancelled.
 * Returns the new balance, or -1 for unlimited/untracked memberships.
 */
export async function restoreSessionCredit(bookingId: string): Promise<number> {
  const { data, error } = await untypedClient.rpc('restore_session_credit', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : -1;
}
