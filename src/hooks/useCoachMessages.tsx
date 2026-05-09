/**
 * useCoachMessagesForKid — paged list of coach messages for the parent
 * Videos → Messages sub-tab. Sister hook to `useLatestCoachMessage` (Home
 * card) — both hit the same `coach_messages` rows but the rail wants the
 * full history, not just the newest one.
 */

import { useQuery } from '@tanstack/react-query';

import {
  listCoachMessagesForKid,
  type LatestCoachMessage,
} from '@/api/coachMessages';

export function coachMessagesByKidKey(kidId: string) {
  return ['coachMessages', 'byKid', kidId] as const;
}

export function useCoachMessagesForKid(kidId: string | null | undefined) {
  return useQuery<LatestCoachMessage[], Error>({
    queryKey: kidId ? coachMessagesByKidKey(kidId) : ['coachMessages', 'byKid', 'none'],
    queryFn: () => listCoachMessagesForKid(kidId as string),
    enabled: !!kidId,
  });
}
