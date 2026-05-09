/**
 * Parent-side messaging hooks (v0.7 task #120). Wraps src/api/parentMessages.ts
 * in TanStack Query mutations + queries. Query keys:
 *
 *   parentMessageKeys.inbox(kidId)              parent's inbox
 *   parentMessageKeys.thread(kidId, coachId)    one bidirectional thread
 *   parentMessageKeys.coaches()                  tenant coaches
 *
 * Mutations invalidate the inbox + relevant thread on success.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  listMessageThread,
  listParentInbox,
  listTenantCoachesForParent,
  sendParentMessage,
  type SendParentMessageInput,
  type SentParentMessage,
} from '@/api/parentMessages';

import { useAuth } from './useAuth';

export const parentMessageKeys = {
  inbox: (kidId: string) => ['parentMessages', 'inbox', kidId] as const,
  thread: (kidId: string, coachUserId: string) =>
    ['parentMessages', 'thread', kidId, coachUserId] as const,
  coaches: () => ['parentMessages', 'coaches'] as const,
};

export function useTenantCoachesForParent() {
  return useQuery({
    queryKey: parentMessageKeys.coaches(),
    queryFn: listTenantCoachesForParent,
    staleTime: 60_000,
  });
}

export function useParentInbox(kidId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: kidId ? parentMessageKeys.inbox(kidId) : ['parentMessages', 'inbox', 'none'],
    enabled: !!kidId && !!user,
    queryFn: () =>
      listParentInbox({ kidId: kidId as string, selfUserId: user!.id }),
  });
}

export function useMessageThread(
  kidId: string | null | undefined,
  coachUserId: string | null | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey:
      kidId && coachUserId
        ? parentMessageKeys.thread(kidId, coachUserId)
        : ['parentMessages', 'thread', 'none'],
    enabled: !!kidId && !!coachUserId && !!user,
    queryFn: () =>
      listMessageThread({
        kidId: kidId as string,
        coachUserId: coachUserId as string,
        selfUserId: user!.id,
      }),
  });
}

export function useSendParentMessage(
  opts: { kidId: string; coachUserId: string } | null,
) {
  const qc = useQueryClient();
  return useMutation<SentParentMessage, Error, SendParentMessageInput>({
    mutationFn: (input) => sendParentMessage(input),
    onSuccess: () => {
      if (opts) {
        void qc.invalidateQueries({
          queryKey: parentMessageKeys.thread(opts.kidId, opts.coachUserId),
        });
        void qc.invalidateQueries({ queryKey: parentMessageKeys.inbox(opts.kidId) });
      }
    },
  });
}
