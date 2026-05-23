/**
 * useWaitlistEntries — fetch active waitlist entries for the authenticated
 * family (status = waiting | notified). TanStack Query with 60-second
 * background refetch so the UI stays roughly fresh.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  listFamilyWaitlistEntries,
  joinWaitlist,
  leaveWaitlist,
  claimWaitlistSpot,
  type WaitlistEntryRich,
  type JoinWaitlistResult,
} from '@/api/waitlist';
import { useFamily } from '@/hooks/useFamily';

export const WAITLIST_QUERY_KEY = 'family_waitlist';

export function useWaitlistEntries() {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

  return useQuery<WaitlistEntryRich[]>({
    queryKey: [WAITLIST_QUERY_KEY, tenantId],
    queryFn: listFamilyWaitlistEntries,
    enabled: !!tenantId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useJoinWaitlist() {
  const queryClient = useQueryClient();

  return useMutation<
    JoinWaitlistResult,
    Error,
    Parameters<typeof joinWaitlist>[0]
  >({
    mutationFn: joinWaitlist,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [WAITLIST_QUERY_KEY] });
    },
  });
}

export function useLeaveWaitlist() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: leaveWaitlist,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [WAITLIST_QUERY_KEY] });
    },
  });
}

export function useClaimWaitlistSpot() {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof claimWaitlistSpot>>,
    Error,
    string
  >({
    mutationFn: claimWaitlistSpot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [WAITLIST_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['family_bookings'] });
    },
  });
}
