/**
 * useActiveMembership — fetches the current kid's active membership.
 *
 * OTC pack holders: returns sessions_remaining / sessions_total.
 * EFT unlimited:    returns membership with sessions_remaining = null.
 * No membership:    returns null.
 */

import { useQuery } from '@tanstack/react-query';

import { getActiveMembership, type ActiveMembership } from '@/api/memberships';
import { useFamily } from '@/hooks/useFamily';

export const activeMembershipKey = (kidId: string) =>
  ['active_membership', kidId] as const;

export function useActiveMembership(): {
  data: ActiveMembership | null | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { family, kids } = useFamily();
  const kid = kids[0] ?? null;

  return useQuery<ActiveMembership | null, Error>({
    queryKey: activeMembershipKey(kid?.id ?? ''),
    queryFn: () => getActiveMembership(kid!.id, family!.tenant_id),
    enabled: !!kid && !!family,
    staleTime: 30_000,
  });
}
