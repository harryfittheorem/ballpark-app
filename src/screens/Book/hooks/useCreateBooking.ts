/**
 * useCreateBooking — TanStack mutation that inserts a confirmed booking.
 *
 * Flow:
 *  1. Pre-check session credits via `checkSessionCredits`.
 *     If credits = 0 → throw NoSessionCreditsError immediately (no booking
 *     row is inserted).
 *  2. Insert the booking row.
 *  3. Call `deductSessionCredit` atomically (FOR UPDATE in the RPC protects
 *     against concurrent bookings racing on the last credit).
 *     If that fails (race condition edge case) → cancel the booking and
 *     re-throw NoSessionCreditsError.
 *
 * On success: invalidates day_bookings, upcoming-session, family_bookings,
 * and active_membership (so the Me tab updates the credit badge immediately).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createBooking, cancelBooking, type Booking, type BookingInsert } from '@/api/bookings';
import {
  checkSessionCredits,
  deductSessionCredit,
} from '@/api/memberships';
import { activeMembershipKey } from '@/hooks/useActiveMembership';

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

  return useMutation<CreateBookingResult, Error, BookingInsert>({
    mutationFn: async (input) => {
      // ── Step 1: Pre-flight credit check (fast UX fail-fast) ──────────────
      const remaining = await checkSessionCredits(input.kid_id, input.tenant_id);
      if (remaining === 0) {
        throw new NoSessionCreditsError();
      }

      // ── Step 2: Insert the booking ────────────────────────────────────────
      const booking = await createBooking(input);

      // ── Step 3: Atomically deduct one credit (FOR UPDATE race guard) ──────
      let sessionsRemaining = -1;
      try {
        sessionsRemaining = await deductSessionCredit(booking.id);
      } catch {
        // Race condition: another concurrent booking consumed the last credit
        // between our pre-check and the deduction. Cancel this booking and
        // surface the error to the caller.
        await cancelBooking(booking.id, 'no_session_credits').catch(() => undefined);
        throw new NoSessionCreditsError();
      }

      return { booking, sessionsRemaining };
    },
    onSuccess: (_result, input) => {
      void qc.invalidateQueries({ queryKey: ['day_bookings'] });
      void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
      void qc.invalidateQueries({ queryKey: ['family_bookings'] });
      void qc.invalidateQueries({ queryKey: activeMembershipKey(input.kid_id) });
    },
  });
}
