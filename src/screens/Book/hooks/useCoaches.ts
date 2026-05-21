/**
 * useCoaches — fetch coaches for the active booking location via TanStack Query.
 *
 * When the user has switched to a specific location (stored in
 * bookingLocationStore), only coaches assigned to that location via the
 * coach_locations junction table are returned. Falls back to the full
 * tenant coach list when no location is resolved.
 *
 * Query key includes locationId so switching locations invalidates the cache
 * and fetches the correct set of coaches for the new location.
 */

import { useQuery } from '@tanstack/react-query';

import { listCoaches, type Coach } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';
import { useBookingLocationStore } from '@/store/bookingLocation';

export function useCoaches() {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;
  const primaryLocationId = family?.primary_location_id ?? null;
  const { activeLocationId } = useBookingLocationStore();

  const locationId = activeLocationId ?? primaryLocationId;

  return useQuery<Coach[]>({
    queryKey: ['coaches', tenantId, locationId],
    queryFn: () => listCoaches(locationId),
    enabled: !!tenantId,
  });
}
