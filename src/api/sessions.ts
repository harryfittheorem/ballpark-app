/**
 * Sessions API helpers (task #119).
 *
 * One row in `public.sessions` = one cage session (a contiguous batch of
 * swings). `swing_count`, `best_exit_velocity_mph`, etc. are pre-aggregated
 * by the polling worker so the Videos → Swings (BY SESSION) grouping
 * renders without re-aggregating swings client-side.
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Session = Database['public']['Tables']['sessions']['Row'];

const SESSION_COLUMNS =
  'id, tenant_id, kid_id, capture_source, capture_session_id, facility_id, started_at, ended_at, swing_count, best_exit_velocity_mph, avg_exit_velocity_mph, max_distance_ft, notes, created_at, updated_at';

/**
 * List every session for a kid, newest first. Default cap of 200 covers
 * roughly 8 months of weekly cage time — well past the spec's smoke-test
 * target. The FlatList in Videos still virtualizes, so a higher cap is
 * cheap if a tenant ever needs it.
 */
export async function listSessionsForKid(
  kidId: string,
  opts: { limit?: number } = {},
): Promise<Session[]> {
  const limit = opts.limit ?? 200;
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('kid_id', kidId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Session[];
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as Session | null) ?? null;
}
