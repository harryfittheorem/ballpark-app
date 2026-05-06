/**
 * useFamilyBooking — fetch a single booking by id with the same embeds as
 * `useFamilyBookings`. Used by the booking detail screen so it can render
 * standalone (and survive a refresh) without depending on the list cache.
 */

import { useQuery } from '@tanstack/react-query';

import { getFamilyBookingById, type FamilyBooking } from '@/api/bookings';

export function useFamilyBooking(bookingId: string | null) {
  return useQuery<FamilyBooking | null>({
    queryKey: ['family_booking', bookingId],
    queryFn: () => getFamilyBookingById(bookingId as string),
    enabled: !!bookingId,
  });
}
