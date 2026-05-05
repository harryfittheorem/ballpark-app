/**
 * useCreateBooking — TanStack mutation that inserts a confirmed booking.
 *
 * On success it invalidates `['day_bookings', ...]` so the time picker
 * immediately drops the freshly-booked slot, and `['upcoming_bookings', ...]`
 * so any future Home-tab "next session" surface can refresh once it lands.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createBooking, type Booking, type BookingInsert } from '@/api/bookings';

export function useCreateBooking() {
  const qc = useQueryClient();

  return useMutation<Booking, Error, BookingInsert>({
    mutationFn: createBooking,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day_bookings'] });
      void qc.invalidateQueries({ queryKey: ['upcoming_bookings'] });
    },
  });
}
