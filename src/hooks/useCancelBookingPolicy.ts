/**
 * useCancelBookingPolicy — TanStack mutation that cancels a booking via the
 * `cancel_booking` SECURITY DEFINER RPC, which enforces the tenant's
 * configurable cancellation-window policy.
 *
 * On { ok: true } it invalidates the same query keys as useCancelBooking so
 * the Bookings list, detail screen, Book tab, and Home "Up Next" card all
 * refresh automatically.
 *
 * On { code: 'LATE_CANCEL' } the mutation resolves (does NOT throw) —
 * the caller must inspect the result and show the warning bottom sheet.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancelBookingRpc, type CancelBookingResult } from '@/api/bookings';

export type CancelBookingPolicyInput = {
  bookingId: string;
  reason?: string;
  override?: boolean;
};

export function useCancelBookingPolicy() {
  const qc = useQueryClient();

  return useMutation<CancelBookingResult, Error, CancelBookingPolicyInput>({
    mutationFn: ({ bookingId, reason, override = false }) =>
      cancelBookingRpc(bookingId, reason, override),

    onSuccess: (result, { bookingId }) => {
      // Only invalidate caches when the booking was actually cancelled
      if ('ok' in result && result.ok) {
        void qc.invalidateQueries({ queryKey: ['family_bookings'] });
        void qc.invalidateQueries({ queryKey: ['booking', bookingId] });
        void qc.invalidateQueries({ queryKey: ['day_bookings'] });
        void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
      }
    },
  });
}
