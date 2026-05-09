/**
 * Achievements + per-kid earned-log hooks.
 */

import { useQuery } from '@tanstack/react-query';

import {
  listAchievements,
  listEarnedForKid,
  type Achievement,
  type KidAchievement,
} from '@/api/achievements';

export const achievementsKeys = {
  catalog: ['achievements', 'catalog'] as const,
  earnedByKid: (kidId: string) => ['achievements', 'earned', kidId] as const,
};

export function useAchievementsCatalog() {
  return useQuery<Achievement[], Error>({
    queryKey: achievementsKeys.catalog,
    queryFn: listAchievements,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEarnedAchievements(kidId: string | null | undefined) {
  return useQuery<KidAchievement[], Error>({
    queryKey: kidId
      ? achievementsKeys.earnedByKid(kidId)
      : ['achievements', 'earned', 'none'],
    queryFn: () => listEarnedForKid(kidId as string),
    enabled: !!kidId,
  });
}
