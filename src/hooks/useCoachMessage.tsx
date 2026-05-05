/**
 * Single coach_message + joined video query (v0.4 Step 4.13).
 *
 * Used by the parent's full-screen `VideoPlaybackScreen` to fetch the
 * Mux playback id, the lifecycle status, and the existing `viewed_at`
 * value for the row that was tapped on Home. Disabled until a messageId
 * is in hand so we never fire a request the RLS policy would reject.
 */

import { useQuery } from '@tanstack/react-query';

import {
  getCoachMessageById,
  type CoachMessageDetail,
} from '@/api/coachMessages';

export function coachMessageKey(messageId: string) {
  return ['coachMessages', 'detail', messageId] as const;
}

export function useCoachMessage(messageId: string | null | undefined) {
  return useQuery<CoachMessageDetail | null, Error>({
    queryKey: messageId
      ? coachMessageKey(messageId)
      : ['coachMessages', 'detail', 'none'],
    queryFn: () => getCoachMessageById(messageId as string),
    enabled: !!messageId,
  });
}
