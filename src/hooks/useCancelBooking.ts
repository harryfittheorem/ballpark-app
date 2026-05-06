/**
 * useCancelBooking — TanStack mutation that soft-cancels a booking.
 *
 * On success it invalidates `['family_bookings', ...]` (so the Bookings list
 * moves the row from Upcoming to Past with a "Cancelled" badge),
 * `['family_booking', bookingId]` (so the detail screen re-renders with the
 * cancelled state), `['day_bookings', ...]` (so the Book tab time picker
 * frees the slot back up), and `['upcoming_bookings', ...]` for any future
 * Home-tab next-session surface.
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
      void qc.invalidateQueries({ queryKey: ['upcoming_bookings'] });
    },
  });
}
