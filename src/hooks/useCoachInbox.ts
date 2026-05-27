/**
 * TanStack Query hook for the coach-side inbox.
 *
 * Query key: ['coachInbox', coachUserId]
 * Enabled only when coachUserId is present (the caller is authenticated as a coach).
 */

import { useQuery } from '@tanstack/react-query';

import { listCoachInbox, listCoachMessageThread } from '@/api/coachInbox';

import { useAuth } from './useAuth';

export const coachInboxKeys = {
  inbox: (coachUserId: string) => ['coachInbox', coachUserId] as const,
  thread: (kidId: string, coachUserId: string) =>
    ['coachInbox', 'thread', kidId, coachUserId] as const,
};

export function useCoachInbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: user ? coachInboxKeys.inbox(user.id) : ['coachInbox', 'none'],
    enabled: !!user,
    queryFn: () => listCoachInbox(user!.id),
    staleTime: 30_000,
  });
}

/**
 * Coach-side message thread for a (kid, coach) pair.
 *
 * Uses listCoachMessageThread which correctly fetches both directions:
 *   - coach→parent (sender_user_id = coachUserId)
 *   - parent→coach (recipient_coach_user_id = coachUserId)
 *
 * This is intentionally separate from useMessageThread (parent-side hook)
 * because the parent hook's `or` filter collapses when selfUserId === coachUserId,
 * causing parent→coach messages to be excluded.
 */
export function useCoachMessageThread(
  kidId: string | null | undefined,
  coachUserId: string | null | undefined,
) {
  return useQuery({
    queryKey:
      kidId && coachUserId
        ? coachInboxKeys.thread(kidId, coachUserId)
        : ['coachInbox', 'thread', 'none'],
    enabled: !!kidId && !!coachUserId,
    queryFn: () =>
      listCoachMessageThread({ kidId: kidId as string, coachUserId: coachUserId as string }),
    staleTime: 15_000,
  });
}
