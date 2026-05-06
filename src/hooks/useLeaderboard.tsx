import { useQuery } from '@tanstack/react-query';

import { listLeaderboard, type LeaderboardEntry } from '@/api/earn';

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: listLeaderboard,
  });
}
