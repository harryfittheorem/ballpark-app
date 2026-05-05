/**
 * useCoachAvailability — fetch the active tenant's `coach_availability`
 * rows via TanStack Query.
 *
 * RLS scopes the result to the caller's tenant; we still key the query by
 * tenantId so a parent on a different tenant gets a clean cache slot.
 */

import { useQuery } from '@tanstack/react-query';

import { listCoachAvailability, type CoachAvailability } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

export function useCoachAvailability() {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

  return useQuery<CoachAvailability[]>({
    queryKey: ['coach_availability', tenantId],
    queryFn: listCoachAvailability,
    enabled: !!tenantId,
  });
}
