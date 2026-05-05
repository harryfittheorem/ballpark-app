/**
 * useTenantKids — TanStack Query wrapper around `listTenantKids`.
 *
 * Cache key is `['tenantKids', tenantId]` so the list survives between
 * coach uploads. We derive `tenantId` from the coach's row (the JWT also
 * carries it, but `useCoach` is already wired into the rest of the coach
 * surface, so we reuse it for consistency). Disabled until the coach row
 * resolves so we don't fire a query keyed on a placeholder.
 */

import { useQuery } from '@tanstack/react-query';

import { listTenantKids, type TenantKid } from '@/api/coachMessages';

import { useCoach } from './useCoach';

export function tenantKidsKey(tenantId: string) {
  return ['tenantKids', tenantId] as const;
}

export function useTenantKids() {
  const { coach } = useCoach();
  const tenantId = coach?.tenant_id ?? null;

  const query = useQuery({
    queryKey: tenantId ? tenantKidsKey(tenantId) : ['tenantKids', 'anonymous'],
    queryFn: () => listTenantKids(),
    enabled: !!tenantId,
  });

  return {
    kids: (query.data ?? []) as TenantKid[],
    loading: !!tenantId && query.isPending,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
