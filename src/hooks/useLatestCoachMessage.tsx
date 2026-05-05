/**
 * Latest coach message for a kid, backed by TanStack Query.
 *
 * Used by the parent's Home tab to render the "Today's video" card. The
 * query is disabled when there's no kid (e.g. before kid registration) so
 * we don't fire a request that the RLS policy would reject anyway.
 */

import { useQuery } from '@tanstack/react-query';

import {
  getLatestCoachMessageForKid,
  type LatestCoachMessage,
} from '@/api/coachMessages';

export function latestCoachMessageKey(kidId: string) {
  return ['coachMessages', 'latest', kidId] as const;
}

export function useLatestCoachMessage(kidId: string | null | undefined) {
  return useQuery<LatestCoachMessage | null, Error>({
    queryKey: kidId
      ? latestCoachMessageKey(kidId)
      : ['coachMessages', 'latest', 'none'],
    queryFn: () => getLatestCoachMessageForKid(kidId as string),
    enabled: !!kidId,
  });
}
