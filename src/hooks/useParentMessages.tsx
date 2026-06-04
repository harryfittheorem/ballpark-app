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

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  listMessageThread,
  listParentInbox,
  listTenantCoachesForParent,
  sendParentMessage,
  type SendParentMessageInput,
  type SentParentMessage,
} from '@/api/parentMessages';
import { supabase } from '@/lib/supabase';

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
  const qc = useQueryClient();

  const query = useQuery({
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

  // Realtime: invalidate thread when a new coach_message arrives so
  // web-portal-sent messages appear without a manual pull-to-refresh.
  useEffect(() => {
    if (!kidId || !coachUserId || !user) return;

    const channel = supabase
      .channel(`parent-thread-${kidId}-${coachUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coach_messages',
          filter: `recipient_kid_id=eq.${kidId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Only react to messages in this (kid, coach) thread.
          if (
            row.sender_user_id !== coachUserId &&
            row.recipient_coach_user_id !== coachUserId
          ) {
            return;
          }
          void qc.invalidateQueries({
            queryKey: parentMessageKeys.thread(kidId, coachUserId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kidId, coachUserId, user, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
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
