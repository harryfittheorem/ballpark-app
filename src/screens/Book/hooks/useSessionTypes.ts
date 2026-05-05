/**
 * useSessionTypes — fetch the active session_types catalogue for the
 * caller's tenant via TanStack Query.
 *
 * Tenant scoping is handled server-side by RLS, but we key the query by the
 * resolved tenant_id so a parent who switched accounts (different tenant)
 * gets a clean cache slot rather than reusing the previous tenant's list.
 */

import { useQuery } from '@tanstack/react-query';

import { listSessionTypes, type SessionType } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

export function useSessionTypes() {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

  return useQuery<SessionType[]>({
    queryKey: ['session_types', tenantId],
    queryFn: listSessionTypes,
    enabled: !!tenantId,
  });
}
