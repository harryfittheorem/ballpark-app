/**
 * useCreateBooking — TanStack mutation that inserts a confirmed booking.
 *
 * On success it invalidates `['day_bookings', ...]` so the Book tab time
 * picker immediately drops the freshly-booked slot, the
 * `upcomingSessionKey(...)` prefix (`['upcoming-session']`) so the Home
 * "Up Next" card picks up the new session without a pull-to-refresh, and
 * `['family_bookings', ...]` so the Me → Bookings list shows it under
 * Upcoming on next visit. Prefix invalidation on `['upcoming-session']`
 * covers every kid in the family — `useUpcomingSession` keys per-kid via
 * `upcomingSessionKey(kidId)` in src/hooks/useUpcomingSession.tsx.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createBooking, type Booking, type BookingInsert } from '@/api/bookings';

export function useCreateBooking() {
  const qc = useQueryClient();

  return useMutation<Booking, Error, BookingInsert>({
    mutationFn: createBooking,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day_bookings'] });
      void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
      void qc.invalidateQueries({ queryKey: ['family_bookings'] });
    },
  });
}
