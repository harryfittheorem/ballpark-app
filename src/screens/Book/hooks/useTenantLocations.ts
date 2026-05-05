/**
 * useTenantLocations — list every location the caller can see, scoped by
 * RLS to their tenant. Used by AddKid's "Home location" picker.
 */

import { useQuery } from '@tanstack/react-query';

import { listTenantLocations, type Location } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

export function useTenantLocations() {
  // Tenant-scoped key (mirrors other tenant-scoped queries) so the cache
  // is shared across screens for the same tenant rather than per-user.
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;
  return useQuery<Location[]>({
    queryKey: ['tenant-locations', tenantId ?? 'anonymous'],
    queryFn: listTenantLocations,
    enabled: !!tenantId,
  });
}
