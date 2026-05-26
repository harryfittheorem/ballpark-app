import { useQuery } from '@tanstack/react-query';

import {
  getHitTraxLeaderboard,
  getLessonCountLeaderboard,
  type AgeGroupFilter,
  type HitTraxLeaderboardEntry,
  type HitTraxMetric,
  type LessonCountLeaderboardEntry,
  type LeaderboardScope,
} from '@/api/leaderboard';
import { listLeaderboard, type LeaderboardEntry } from '@/api/earn';

// ---------------------------------------------------------------------------
// Points leaderboard (existing)
// ---------------------------------------------------------------------------

export function usePointsLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', 'points'],
    queryFn: listLeaderboard,
    staleTime: 60 * 1000,
  });
}

/**
 * @deprecated Use usePointsLeaderboard() instead.
 * Kept for backward-compat with any callers that still import useLeaderboard.
 */
export function useLeaderboard() {
  return usePointsLeaderboard();
}

// ---------------------------------------------------------------------------
// HitTrax leaderboard
// ---------------------------------------------------------------------------

export function useHitTraxLeaderboard(opts: {
  metric: HitTraxMetric;
  scope: LeaderboardScope;
  locationId: string | null;
  ageGroup: AgeGroupFilter;
}) {
  return useQuery<HitTraxLeaderboardEntry[]>({
    queryKey: ['leaderboard', 'hittrax', opts.metric, opts.scope, opts.locationId, opts.ageGroup],
    queryFn: () =>
      getHitTraxLeaderboard({
        metric:     opts.metric,
        scope:      opts.scope,
        locationId: opts.locationId,
        ageGroup:   opts.ageGroup,
      }),
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Lesson-count leaderboard
// ---------------------------------------------------------------------------

export function useLessonCountLeaderboard(opts: {
  locationId: string | null;
}) {
  return useQuery<LessonCountLeaderboardEntry[]>({
    queryKey: ['leaderboard', 'lessons', opts.locationId],
    queryFn: () => getLessonCountLeaderboard({ locationId: opts.locationId }),
    staleTime: 60 * 1000,
  });
}
