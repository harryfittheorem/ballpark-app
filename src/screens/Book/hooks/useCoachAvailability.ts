/**
 * useCoachAvailability — fetch coach_availability rows for the family's
 * primary booking location via TanStack Query.
 *
 * Location switching has been removed from the member-facing flow; this
 * hook always resolves to the family's primary_location_id.
 */

import { useQuery } from '@tanstack/react-query';

import { listCoachAvailability, type CoachAvailability } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

export function useCoachAvailability() {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;
  const locationId = family?.primary_location_id ?? null;

  return useQuery<CoachAvailability[]>({
    queryKey: ['coach_availability', tenantId, locationId],
    queryFn: () => listCoachAvailability(locationId),
    enabled: !!tenantId,
  });
}
