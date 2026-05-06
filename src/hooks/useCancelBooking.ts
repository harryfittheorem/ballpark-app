/**
 * useCancelBooking — TanStack mutation that soft-cancels a booking.
 *
 * On success it invalidates `['family_bookings', ...]` (so the Bookings list
 * moves the row from Upcoming to Past with a "Cancelled" badge),
 * `['family_booking', bookingId]` (so the detail screen re-renders with the
 * cancelled state), `['day_bookings', ...]` (so the Book tab time picker
 * frees the slot back up), and the `upcomingSessionKey(...)` prefix
 * (`['upcoming-session']`) so the Home "Up Next" card re-fetches and either
 * drops the cancelled session or rolls forward to the next one — without a
 * pull-to-refresh. The kid id isn't on the booking row we get back, so we
 * invalidate by prefix to cover every kid in the family.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancelBooking, type Booking } from '@/api/bookings';

export type CancelBookingInput = { bookingId: string; reason?: string };

export function useCancelBooking() {
  const qc = useQueryClient();

  return useMutation<Booking, Error, CancelBookingInput>({
    mutationFn: ({ bookingId, reason }) => cancelBooking(bookingId, reason),
    onSuccess: (booking) => {
      void qc.invalidateQueries({ queryKey: ['family_bookings'] });
      void qc.invalidateQueries({ queryKey: ['family_booking', booking.id] });
      void qc.invalidateQueries({ queryKey: ['day_bookings'] });
      // Prefix match — invalidates every ['upcoming-session', kidId] entry.
      // See `upcomingSessionKey` in src/hooks/useUpcomingSession.tsx.
      void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
    },
  });
}
