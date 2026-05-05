/**
 * useTenantLocations — list every location the caller can see, scoped by
 * RLS to their tenant. Used by AddKid's "Home location" picker.
 */

import { useQuery } from '@tanstack/react-query';

import { listTenantLocations, type Location } from '@/api/bookings';
import { useAuth } from '@/hooks/useAuth';

export function useTenantLocations() {
  const { user } = useAuth();
  return useQuery<Location[]>({
    queryKey: ['tenant-locations', user?.id ?? 'anonymous'],
    queryFn: listTenantLocations,
    enabled: !!user,
  });
}
