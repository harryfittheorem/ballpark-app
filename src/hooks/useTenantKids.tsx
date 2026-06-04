/**
 * useTenantKids — TanStack Query wrapper around `listTenantKids`.
 *
 * Cache key is `['tenantKids', tenantId]` so the list survives between
 * coach uploads. We derive `tenantId` from the coach's row when available,
 * and fall back to the JWT `tenant_id` claim for admin/owner users who do
 * not have a row in `public.coaches`. The query stays disabled until at
 * least one source resolves a non-null tenant id.
 */

import { useQuery } from '@tanstack/react-query';

import { listTenantKids, type TenantKid } from '@/api/coachMessages';

import { useAuth } from './useAuth';
import { useCoach } from './useCoach';

/**
 * Decode a single string claim from an already-verified JWT access token.
 * We only read it for UX purposes (enabling the query); the server enforces
 * RLS independently, so a plain base64url decode without re-verification is safe.
 */
function jwtClaim(token: string | undefined, key: string): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const payload = JSON.parse(globalThis.atob(b64)) as Record<string, unknown>;
    const val = payload[key];
    return typeof val === 'string' ? val : null;
  } catch {
    return null;
  }
}

export function tenantKidsKey(tenantId: string) {
  return ['tenantKids', tenantId] as const;
}

export function useTenantKids() {
  const { coach } = useCoach();
  const { session } = useAuth();

  // Admin/owner users may not have a row in public.coaches; fall back to the
  // tenant_id claim from the JWT so the query is still enabled for them.
  const tenantId =
    coach?.tenant_id ??
    jwtClaim(session?.access_token, 'tenant_id') ??
    null;

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
