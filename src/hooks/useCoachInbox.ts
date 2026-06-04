/**
 * TanStack Query hooks for the coach-side inbox, with Supabase Realtime
 * subscriptions that keep both the thread view and the inbox list up to date
 * without a manual pull-to-refresh.
 *
 * Realtime strategy
 * ─────────────────
 * useCoachInbox
 *   Subscribes to INSERT events on coach_messages.  When a new row arrives
 *   that involves this coach (as sender OR as recipient_coach_user_id),
 *   it invalidates the inbox query so the last-message preview and unread
 *   dot refresh automatically.
 *
 * useCoachMessageThread
 *   Subscribes to INSERT events filtered to recipient_kid_id = kidId.
 *   New rows whose thread matches (kidId, coachUserId) are appended
 *   directly to the TanStack Query cache so they appear immediately without
 *   a full refetch.  Video rows arrive with null playback ids (Mux hasn't
 *   processed them yet) — the UI shows "Still processing…" which is correct.
 *   The inbox query is also invalidated so the conversation list stays fresh.
 *
 * Channel naming avoids collisions: one channel per (coach, thread) pair.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { CoachThreadMessage } from '@/api/coachInbox';
import { listCoachInbox, listCoachMessageThread } from '@/api/coachInbox';
import { supabase } from '@/lib/supabase';

import { useAuth } from './useAuth';

export const coachInboxKeys = {
  inbox: (coachUserId: string) => ['coachInbox', coachUserId] as const,
  thread: (kidId: string, coachUserId: string) =>
    ['coachInbox', 'thread', kidId, coachUserId] as const,
};

export function useCoachInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: user ? coachInboxKeys.inbox(user.id) : ['coachInbox', 'none'],
    enabled: !!user,
    queryFn: () => listCoachInbox(user!.id),
    staleTime: 30_000,
  });

  // Realtime: invalidate inbox when any new coach_message involving this coach
  // arrives so the last-message preview and unread dot update automatically.
  useEffect(() => {
    if (!user) return;
    const coachUserId = user.id;

    const channel = supabase
      .channel(`coach-inbox-list-${coachUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'coach_messages' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Only react when this coach is the sender or the named recipient.
          if (
            row.sender_user_id !== coachUserId &&
            row.recipient_coach_user_id !== coachUserId
          ) {
            return;
          }
          void qc.invalidateQueries({
            queryKey: coachInboxKeys.inbox(coachUserId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
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
 *
 * Realtime: new INSERT rows for this thread are appended directly to the
 * TanStack Query cache so they appear instantly.  The inbox list is also
 * invalidated so the last-message preview stays current.
 */
export function useCoachMessageThread(
  kidId: string | null | undefined,
  coachUserId: string | null | undefined,
) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey:
      kidId && coachUserId
        ? coachInboxKeys.thread(kidId, coachUserId)
        : ['coachInbox', 'thread', 'none'],
    enabled: !!kidId && !!coachUserId,
    queryFn: () =>
      listCoachMessageThread({ kidId: kidId as string, coachUserId: coachUserId as string }),
    staleTime: 15_000,
  });

  // Realtime: append incoming messages to the cache immediately.
  useEffect(() => {
    if (!kidId || !coachUserId) return;

    const channel = supabase
      .channel(`coach-thread-${kidId}-${coachUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coach_messages',
          // Server-side filter: only rows for this kid's thread are delivered.
          filter: `recipient_kid_id=eq.${kidId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;

          // Confirm this message is for our (kidId, coachUserId) thread —
          // the server filter already handles kidId, but we double-check the
          // coach side to avoid cross-contamination when a kid has multiple coaches.
          if (
            row.sender_user_id !== coachUserId &&
            row.recipient_coach_user_id !== coachUserId
          ) {
            return;
          }

          const threadKey = coachInboxKeys.thread(kidId, coachUserId);

          qc.setQueryData<CoachThreadMessage[]>(threadKey, (prev) => {
            if (!prev) return prev;
            // Guard against duplicate deliveries (Realtime can replay).
            if (prev.some((m) => m.id === (row.id as string))) return prev;

            const msg: CoachThreadMessage = {
              id: row.id as string,
              createdAt: row.created_at as string,
              senderUserId: row.sender_user_id as string,
              recipientFamilyId: (row.recipient_family_id as string) ?? '',
              recipientKidId: (row.recipient_kid_id as string) ?? kidId,
              recipientCoachUserId:
                (row.recipient_coach_user_id as string | null) ?? null,
              messageText: (row.message_text as string | null) ?? null,
              label: (row.label as string | null) ?? null,
              senderDisplay: (row.sender_display as string | null) ?? null,
              viewedAt: (row.viewed_at as string | null) ?? null,
              // Video rows arrive with null playback id — Mux hasn't processed
              // them yet.  The Bubble component renders "Still processing…".
              video: null,
            };

            return [...prev, msg];
          });

          // Keep the inbox list preview current.
          void qc.invalidateQueries({
            queryKey: coachInboxKeys.inbox(coachUserId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kidId, coachUserId, qc]);

  return query;
}
