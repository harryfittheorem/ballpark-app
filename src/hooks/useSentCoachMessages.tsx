/**
 * Sent coach-messages list hook (v0.4 Step 4.11).
 *
 * Wraps `listSentCoachMessages()` in a TanStack query keyed
 * `['coachMessages', 'sent', userId]` — the same key
 * `useSendCoachMessage()` invalidates on successful insert, so a freshly
 * sent message appears immediately when the coach lands here.
 *
 * Also refetches when the screen regains focus (`useFocusEffect`) — covers
 * the case where the coach navigates back from another tab and a webhook
 * has flipped a video status / a parent has marked something viewed in
 * the meantime. The list itself is the source of truth, not the cache.
 */

import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  listSentCoachMessages,
  type SentCoachMessageRow,
} from '@/api/coachMessages';

import { useAuth } from './useAuth';
import { sentCoachMessagesKey } from './useSendCoachMessage';

export function useSentCoachMessages() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery<SentCoachMessageRow[], Error>({
    queryKey: userId
      ? sentCoachMessagesKey(userId)
      : ['coachMessages', 'sent', 'anonymous'],
    queryFn: () => listSentCoachMessages(userId as string),
    enabled: !!userId,
  });

  // Refetch on screen focus so coming back from another tab pulls in any
  // new messages (or viewed_at flips) without forcing a manual pull.
  useFocusEffect(
    useCallback(() => {
      if (userId) void query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]),
  );

  return query;
}
