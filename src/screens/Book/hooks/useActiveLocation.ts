/**
 * useActiveLocation — like usePrimaryLocation, but honours the session-scoped
 * location the user may have switched to via the LocationContextPill.
 *
 * Priority:
 *   1. bookingLocationStore.activeLocationId (user switched for this session)
 *   2. family.primary_location_id (JWT default)
 *   3. null (unauthenticated / data not yet loaded)
 *
 * Returns the same TanStack Query shape as usePrimaryLocation so callers can
 * be swapped without any other code changes. Uses the same query key
 * ['location', id] so the result is served from cache when useLocationContext
 * has already fetched it.
 */

import { useQuery } from '@tanstack/react-query';

import { getLocationById, type Location } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';
import { useBookingLocationStore } from '@/store/bookingLocation';

export function useActiveLocation() {
  const { family } = useFamily();
  const primaryLocationId = family?.primary_location_id ?? null;
  const { activeLocationId } = useBookingLocationStore();

  // Prefer the store value (set when user switches via pill); fall back to primary.
  const resolvedId = activeLocationId ?? primaryLocationId;

  return useQuery<Location | null>({
    queryKey: ['location', resolvedId],
    queryFn: () => getLocationById(resolvedId as string),
    enabled: !!resolvedId,
  });
}
