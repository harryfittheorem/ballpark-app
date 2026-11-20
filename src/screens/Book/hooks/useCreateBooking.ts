/**
 * useCreateBooking — TanStack mutation that inserts a confirmed booking.
 *
 * The server commits booking, capacity reservation, retry receipt and credit
 * deduction in one transaction. A lost response can be retried with the same
 * request ID without duplicating the booking or spending another credit.
 *
 * On success: invalidates day_bookings, upcoming-session, family_bookings,
 * and active_membership (so the Me tab updates the credit badge immediately).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { createBooking, type Booking, type BookingInsert } from '@/api/bookings';
import { activeMembershipKey } from '@/hooks/useActiveMembership';
import { uuidv4 } from '@/utils/uuid';

export class NoSessionCreditsError extends Error {
  readonly code = 'NO_SESSION_CREDITS' as const;
  constructor() {
    super('no_session_credits');
    this.name = 'NoSessionCreditsError';
  }
}

export function isNoSessionCreditsError(err: unknown): err is NoSessionCreditsError {
  return err instanceof NoSessionCreditsError ||
    (err instanceof Error && err.message.includes('no_session_credits'));
}

export type CreateBookingResult = {
  booking: Booking;
  sessionsRemaining: number;
};

export function useCreateBooking() {
  const qc = useQueryClient();
  const request = useRef<{ payload: string; id: string } | null>(null);

  return useMutation<CreateBookingResult, Error, BookingInsert>({
    mutationFn: async (input) => {
      const payload = JSON.stringify(input);
      if (request.current?.payload !== payload) request.current = { payload, id: uuidv4() };
      const booking = await createBooking(input, request.current.id);
      return { booking, sessionsRemaining: booking.sessionsRemaining };
    },
    onSuccess: (_result, input) => {
      void qc.invalidateQueries({ queryKey: ['day_bookings'] });
      void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
      void qc.invalidateQueries({ queryKey: ['family_bookings'] });
      void qc.invalidateQueries({ queryKey: activeMembershipKey(input.kid_id) });
    },
  });
}
