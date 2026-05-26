/**
 * useActiveLocation — resolves the location for the current booking session.
 *
 * Always uses the family's primary location (set at signup / by admin).
 * Location switching is an admin-only operation — the Bring-a-Friend pill
 * and LocationContextPill have been removed from the member-facing booking
 * flow per v1 Infinite Hitting product decision.
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
