/**
 * useHitTraxLink — TanStack Query hook for the (kid, hittrax) link row.
 *
 * Primary transport is a Realtime postgres_changes subscription on
 * `kid_capture_links` — when hittrax-poll UPDATEs the row we invalidate
 * the cache and the UI flips immediately.
 *
 * v1.3: new connections go straight to 'active'. The 'pending' refetch
 * interval is kept for backward-compat with any existing v1.x users who
 * linked before the API upgrade (they'll still see "pending" until they
 * cancel + re-link via the new flow).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

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
  const instanceId = useRef(`${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!kidId) return;
    const channel = supabase
      .channel(`hittrax-link-${kidId}-${instanceId.current}`)
      .on(
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
      if (link?.association_status === 'pending') return 5_000;
      if (link?.association_status === 'active') return 60_000;
      return false;
    },
  });
}

export function useAssociateHitTrax(kidId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<AssociateResponse, Error, { hittraxUsername: string; hittraxPassword: string }>({
    mutationFn: ({ hittraxUsername, hittraxPassword }) => {
      if (!kidId) throw new Error('No kid selected');
      return associateHitTrax(kidId, hittraxUsername, hittraxPassword);
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
