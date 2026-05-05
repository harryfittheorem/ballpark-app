/**
 * useFamilyBookings — fetch every booking for the current family's kids in
 * a single query, including kid / coach / location names for display.
 *
 * Query key is family-scoped and includes a stable hash of the kid ids so
 * the cache automatically invalidates when a kid is added or removed (the
 * `useFamily` query refresh produces a new kids array, which produces a new
 * key here).
 */

import { useQuery } from '@tanstack/react-query';

import { listFamilyBookings, type FamilyBooking } from '@/api/bookings';

import { useFamily } from './useFamily';

export function useFamilyBookings() {
  const { family, kids } = useFamily();
  const familyId = family?.id ?? null;
  const kidIds = kids.map((k) => k.id).sort();

  return useQuery<FamilyBooking[]>({
    queryKey: ['family_bookings', familyId, kidIds],
    queryFn: () => listFamilyBookings(kidIds),
    enabled: !!familyId,
  });
}
