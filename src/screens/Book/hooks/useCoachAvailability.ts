/**
 * useCoachAvailability — fetch coach_availability rows for the active booking
 * location via TanStack Query.
 *
 * When the user has switched to a specific location, only availability for
 * coaches assigned to that location (via coach_locations) is returned.
 * Falls back to tenant-wide availability when no location is resolved.
 *
 * Query key includes locationId so switching locations fetches the correct
 * availability windows for the selected location's coaches.
 */

import { useQuery } from '@tanstack/react-query';

import { listCoachAvailability, type CoachAvailability } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';
import { useBookingLocationStore } from '@/store/bookingLocation';

export function useCoachAvailability() {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;
  const primaryLocationId = family?.primary_location_id ?? null;
  const { activeLocationId } = useBookingLocationStore();

  const locationId = activeLocationId ?? primaryLocationId;

  return useQuery<CoachAvailability[]>({
    queryKey: ['coach_availability', tenantId, locationId],
    queryFn: () => listCoachAvailability(locationId),
    enabled: !!tenantId,
  });
}
