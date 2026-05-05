/**
 * usePrimaryLocation — fetch the family's primary location row via TanStack
 * Query so we can read its `timezone` for date calculations.
 */

import { useQuery } from '@tanstack/react-query';

import { getLocationById, type Location } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

export function usePrimaryLocation() {
  const { family } = useFamily();
  const locationId = family?.primary_location_id ?? null;

  return useQuery<Location | null>({
    queryKey: ['location', locationId],
    queryFn: () => getLocationById(locationId as string),
    enabled: !!locationId,
  });
}
