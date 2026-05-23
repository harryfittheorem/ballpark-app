/**
 * Waiver gate hook.
 *
 * Returns the active waiver for the tenant and whether the currently
 * authenticated family has already signed it. Used by RootNavigator to
 * block access to MainTabNavigator until the waiver is accepted.
 *
 * Backed by TanStack Query so the status refreshes automatically after
 * sign_waiver() is called (caller should invalidate the query).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getActiveWaiver, getFamilyWaiver, signWaiver } from '@/api/waivers';
import { useAuth } from '@/hooks/useAuth';

const ACTIVE_WAIVER_KEY = ['waivers', 'active'] as const;
function familyWaiverKey(waiverId: string) {
  return ['waivers', 'family', waiverId] as const;
}

export function useActiveWaiver() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ACTIVE_WAIVER_KEY,
    queryFn: getActiveWaiver,
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFamilyWaiver(waiverId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: waiverId ? familyWaiverKey(waiverId) : ['waivers', 'family', 'none'],
    queryFn: () => (waiverId ? getFamilyWaiver(waiverId) : null),
    enabled: !!session && !!waiverId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Consolidated gate hook used by RootNavigator.
 *
 * Returns:
 *   loading       — still fetching (show splash)
 *   needsWaiver   — family must sign before accessing the app
 *   activeWaiver  — the waiver document to display
 */
export function useWaiverGate() {
  const { data: activeWaiver, isLoading: waiverLoading } = useActiveWaiver();
  const { data: familyWaiver, isLoading: signedLoading } = useFamilyWaiver(activeWaiver?.id);

  const loading = waiverLoading || (!!activeWaiver && signedLoading);
  const needsWaiver = !loading && !!activeWaiver && !familyWaiver;

  return { loading, needsWaiver, activeWaiver: activeWaiver ?? null };
}

/** Mutation that calls sign_waiver and invalidates the gate queries. */
export function useSignWaiver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signWaiver,
    onSuccess: (_data, waiverId) => {
      void queryClient.invalidateQueries({ queryKey: familyWaiverKey(waiverId) });
    },
  });
}
