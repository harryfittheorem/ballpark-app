/**
 * Leaderboard API helpers — HitTrax all-time records and lesson-count board.
 *
 * Both RPCs are SECURITY DEFINER and tenant-pin via JWT; the client only
 * passes the filter params. Tenant_id is derived server-side from the claim.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// Cast to the un-typed client until next database.ts regen picks up the
// new RPCs from the migration.
const sb: SupabaseClient = supabase as unknown as SupabaseClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HitTraxMetric = 'exit_velocity_mph' | 'distance_ft';
export type LeaderboardScope = 'national' | 'clubhouse';
export type AgeGroupFilter = string | null;  // '8U' | '10U' | '12U' | '14U' | 'HS' | 'College' | null

export type HitTraxLeaderboardEntry = {
  kidId: string;
  firstName: string;
  lastName: string;
  ageGroup: string | null;
  value: number;
  rank: number;
};

export type LessonCountLeaderboardEntry = {
  kidId: string;
  firstName: string;
  lastName: string;
  lessonCount: number;
  rank: number;
};

// ---------------------------------------------------------------------------
// HitTrax leaderboard
// ---------------------------------------------------------------------------

/**
 * Returns top-50 all-time personal bests for the given metric, optionally
 * scoped by age group and/or location.
 *
 * p_scope = 'national'  → all kids in the tenant (all locations)
 * p_scope = 'clubhouse' → only kids whose primary_location_id matches
 */
export async function getHitTraxLeaderboard(opts: {
  metric: HitTraxMetric;
  scope?: LeaderboardScope;
  locationId?: string | null;
  ageGroup?: AgeGroupFilter;
}): Promise<HitTraxLeaderboardEntry[]> {
  const { metric, scope = 'national', locationId = null, ageGroup = null } = opts;

  const { data, error } = await sb.rpc('get_hittrax_leaderboard', {
    p_metric:      metric,
    p_scope:       scope,
    p_location_id: locationId,
    p_age_group:   ageGroup,
  });

  if (error) throw error;

  return ((data as unknown[]) ?? []).map((row: unknown) => {
    const r = row as {
      kid_id: string;
      first_name: string;
      last_name: string;
      age_group: string | null;
      value: number;
      rank: number;
    };
    return {
      kidId:     r.kid_id,
      firstName: r.first_name,
      lastName:  r.last_name,
      ageGroup:  r.age_group,
      value:     Number(r.value),
      rank:      Number(r.rank),
    };
  });
}

// ---------------------------------------------------------------------------
// Lesson-count leaderboard
// ---------------------------------------------------------------------------

/**
 * Returns top-50 active members ranked by total completed bookings at the
 * given location. Pass null to see all locations in the tenant.
 */
export async function getLessonCountLeaderboard(opts: {
  locationId?: string | null;
}): Promise<LessonCountLeaderboardEntry[]> {
  const { locationId = null } = opts;

  const { data, error } = await sb.rpc('get_lesson_count_leaderboard', {
    p_location_id: locationId,
  });

  if (error) throw error;

  return ((data as unknown[]) ?? []).map((row: unknown) => {
    const r = row as {
      kid_id: string;
      first_name: string;
      last_name: string;
      lesson_count: number;
      rank: number;
    };
    return {
      kidId:       r.kid_id,
      firstName:   r.first_name,
      lastName:    r.last_name,
      lessonCount: Number(r.lesson_count),
      rank:        Number(r.rank),
    };
  });
}
