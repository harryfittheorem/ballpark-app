/**
 * Mutation hook for sending a coach video message.
 *
 * Wraps `sendCoachMessage()` (src/api/coachMessages.ts) in a TanStack
 * mutation. On success, invalidates the per-coach sent-videos query key
 * (`['coachMessages', 'sent', userId]`) so that when the coach navigates
 * to "My Videos" right after sending, the new row shows up. The list
 * itself lands in Step 4.11; we standardise the key now so the two steps
 * agree without retrofitting later.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  sendCoachMessage,
  type SendCoachMessageInput,
  type SentCoachMessage,
} from '@/api/coachMessages';

import { useAuth } from './useAuth';

export function sentCoachMessagesKey(userId: string) {
  return ['coachMessages', 'sent', userId] as const;
}

export function useSendCoachMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation<SentCoachMessage, Error, SendCoachMessageInput>({
    mutationFn: (input) => sendCoachMessage(input),
    onSuccess: () => {
      if (user) {
        void qc.invalidateQueries({ queryKey: sentCoachMessagesKey(user.id) });
      }
    },
  });
}
