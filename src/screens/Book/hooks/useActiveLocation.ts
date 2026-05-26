/**
 * useActiveLocation — resolves the location for the current booking session.
 *
 * Always returns the family's primary_location_id (set at signup / by admin).
 * Location is fixed per family — in-app switching has been removed.
 */

import { useQuery } from '@tanstack/react-query';

import { getLocationById, type Location } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

export function useActiveLocation() {
  const { family } = useFamily();
  const primaryLocationId = family?.primary_location_id ?? null;

  return useQuery<Location | null>({
    queryKey: ['location', primaryLocationId],
    queryFn: () => getLocationById(primaryLocationId as string),
    enabled: !!primaryLocationId,
  });
}
