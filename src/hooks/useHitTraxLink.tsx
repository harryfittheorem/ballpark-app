/**
 * useHitTraxLink — TanStack Query hook for the (kid, hittrax) link row.
 *
 * Primary transport is a Realtime postgres_changes subscription on
 * `kid_capture_links` — when hittrax-registration-complete or hittrax-poll
 * UPDATEs the row, we invalidate the cache and the UI flips immediately.
 *
 * A short refetch interval (5s while pending, 60s while active) is kept as
 * a fallback for environments where the Realtime channel hasn't connected
 * yet (cold start, network flap) so the parent never gets stuck staring at
 * a stale "Pending" state.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  associateHitTrax,
  disconnectHitTrax,
  getHitTraxLinkForKid,
  type AssociateResponse,
  type KidCaptureLink,
} from '@/api/hittrax';
import { supabase } from '@/lib/supabase';

export function hittraxLinkKey(kidId: string) {
  return ['hittrax-link', kidId] as const;
}

export function useHitTraxLink(kidId: string | undefined) {
  const qc = useQueryClient();

  // Realtime subscription on the kid_capture_links row for this kid. Any
  // INSERT/UPDATE/DELETE invalidates the query so the UI re-reads via the
  // SAFE_COLUMNS allow-list (the realtime payload itself isn't trusted —
  // we never touch the password column even if it appears in the diff).
  useEffect(() => {
    if (!kidId) return;
    const channel = supabase
      .channel(`hittrax-link-${kidId}`)
      .on(
        // postgres_changes is typed with `any` upstream; cast keeps strict mode happy.
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'kid_capture_links',
          filter: `kid_id=eq.${kidId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: hittraxLinkKey(kidId) });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kidId, qc]);

  return useQuery<KidCaptureLink | null>({
    queryKey: kidId ? hittraxLinkKey(kidId) : ['hittrax-link', 'none'],
    queryFn: () => getHitTraxLinkForKid(kidId as string),
    enabled: !!kidId,
    refetchInterval: (query) => {
      const link = query.state.data;
      // Fallback for when the Realtime channel hasn't connected yet.
      if (link?.association_status === 'pending') return 5_000;
      if (link?.association_status === 'active') return 60_000;
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
