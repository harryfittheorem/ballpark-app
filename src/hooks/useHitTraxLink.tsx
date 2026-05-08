/**
 * useHitTraxLink — TanStack Query hook for the (kid, hittrax) link row.
 *
 * Polls every 5s while the link is in 'pending' so the UI flips to
 * Connected as soon as hittrax-registration-complete fires. Once the link
 * is in a terminal state (active / declined / removed) we drop back to a
 * 60s refetch interval — the UI shows the cursor freshness anyway.
 *
 * Realtime postgres_changes would be lighter on requests but requires the
 * publication setup not done in v0.7; the 5s poll is a deliberately small
 * tax for the pending window only.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  associateHitTrax,
  disconnectHitTrax,
  getHitTraxLinkForKid,
  type AssociateResponse,
  type KidCaptureLink,
} from '@/api/hittrax';

export function hittraxLinkKey(kidId: string) {
  return ['hittrax-link', kidId] as const;
}

export function useHitTraxLink(kidId: string | undefined) {
  return useQuery<KidCaptureLink | null>({
    queryKey: kidId ? hittraxLinkKey(kidId) : ['hittrax-link', 'none'],
    queryFn: () => getHitTraxLinkForKid(kidId as string),
    enabled: !!kidId,
    refetchInterval: (query) => {
      const link = query.state.data;
      // While we're waiting on the parent to tap the HitTrax email, poll fast.
      if (link?.association_status === 'pending') return 5_000;
      // Once active, refresh occasionally so last_polled_through stays fresh.
      if (link?.association_status === 'active') return 60_000;
      // No link / declined / removed — let pull-to-refresh drive it.
      return false;
    },
  });
}

export function useAssociateHitTrax(kidId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<AssociateResponse, Error, { hittraxUserId: string }>({
    mutationFn: ({ hittraxUserId }) => {
      if (!kidId) throw new Error('No kid selected');
      return associateHitTrax(kidId, hittraxUserId);
    },
    onSuccess: () => {
      if (kidId) void qc.invalidateQueries({ queryKey: hittraxLinkKey(kidId) });
    },
  });
}

export function useDisconnectHitTrax(kidId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<{ link_id: string }, Error, void>({
    mutationFn: () => {
      if (!kidId) throw new Error('No kid selected');
      return disconnectHitTrax(kidId);
    },
    onSuccess: () => {
      if (kidId) void qc.invalidateQueries({ queryKey: hittraxLinkKey(kidId) });
    },
  });
}
