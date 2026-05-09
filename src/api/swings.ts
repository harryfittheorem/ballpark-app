/**
 * Swings API helpers (task #119).
 *
 * Reads against `public.swings` and `public.personal_bests`. RLS scopes
 * to the parent's own family — see migration 20260508060000.
 *
 * `raw` is excluded from every projection: it's the verbatim HitTrax
 * payload kept for ops debugging, never rendered, and would balloon
 * payload size + leak third-party shape into the client bundle.
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type SwingRow = Database['public']['Tables']['swings']['Row'];

export type Swing = Omit<SwingRow, 'raw'>;

export type PersonalBest = Database['public']['Tables']['personal_bests']['Row'];

export type SwingMetric =
  | 'exit_velocity_mph'
  | 'launch_angle_deg'
  | 'distance_ft'
  | 'pitch_speed_mph';

const SWING_COLUMNS =
  'id, tenant_id, kid_id, session_id, capture_source, capture_event_id, occurred_at, exit_velocity_mph, launch_angle_deg, distance_ft, contact_quality, result, pitch_speed_mph, spray_angle_deg, is_personal_best, created_at';

/**
 * List every swing for a kid, newest first. The Videos tab "All swings"
 * grid renders this directly, so the cap (`limit`) prevents an over-fetch
 * if a power user has thousands of swings — the FlatList virtualizes
 * inside, and the parent rarely needs the full historical tail in one
 * request. Default 500 matches the spec's "scroll 500+ swings" target.
 */
export async function listSwingsForKid(
  kidId: string,
  opts: { limit?: number } = {},
): Promise<Swing[]> {
  const limit = opts.limit ?? 500;
  const { data, error } = await supabase
    .from('swings')
    .select(SWING_COLUMNS)
    .eq('kid_id', kidId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Swing[];
}

/**
 * List every swing in a single session, newest first. Powers Session
 * Detail. RLS still scopes by kid_id ownership via the session_id FK.
 */
export async function listSwingsForSession(sessionId: string): Promise<Swing[]> {
  const { data, error } = await supabase
    .from('swings')
    .select(SWING_COLUMNS)
    .eq('session_id', sessionId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Swing[];
}

/** Single swing by id; returns null if RLS hides it. */
export async function getSwing(swingId: string): Promise<Swing | null> {
  const { data, error } = await supabase
    .from('swings')
    .select(SWING_COLUMNS)
    .eq('id', swingId)
    .maybeSingle();
  if (error) throw error;
  return (data as Swing | null) ?? null;
}

/**
 * All personal bests for a kid (one row per metric).
 */
export async function listPersonalBestsForKid(kidId: string): Promise<PersonalBest[]> {
  const { data, error } = await supabase
    .from('personal_bests')
    .select('*')
    .eq('kid_id', kidId)
    .order('achieved_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PersonalBest[];
}

/**
 * Single most-recently-achieved personal best for a kid (any metric).
 * Powers the Home "Latest personal best" card. Returns null when the
 * kid has no PRs yet, in which case the Home card renders an honest
 * "No personal bests yet — head to the cage" empty state.
 */
export async function getLatestPersonalBestForKid(kidId: string): Promise<PersonalBest | null> {
  const { data, error } = await supabase
    .from('personal_bests')
    .select('*')
    .eq('kid_id', kidId)
    .order('achieved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PersonalBest | null) ?? null;
}
