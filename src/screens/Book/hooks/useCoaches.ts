/**
 * useCoaches — fetch the active tenant's `coaches` rows via TanStack Query.
 * RLS scopes by tenant; we still key the query by tenantId.
 */

import { useQuery } from '@tanstack/react-query';

import { listCoaches, type Coach } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

export function useCoaches() {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

  return useQuery<Coach[]>({
    queryKey: ['coaches', tenantId],
    queryFn: listCoaches,
    enabled: !!tenantId,
  });
}
