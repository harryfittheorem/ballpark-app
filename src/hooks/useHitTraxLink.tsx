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
 *
 * Three association paths:
 *   useAssociateHitTrax       — Mode 1 (password)
 *   useTriggerHitTraxOTP      — Mode 2 (send SMS code, no link yet)
 *   useAssociateHitTraxWithOTP — Mode 3 (submit SMS code → link active)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  associateHitTrax,
  associateHitTraxWithOTP,
  createHitTraxAccount,
  disconnectHitTrax,
  getHitTraxLinkForKid,
  triggerHitTraxOTP,
  type AssociateResponse,
  type CreateHitTraxAccountInput,
  type KidCaptureLink,
  type OTPTriggerResponse,
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

/** Mode 1: password-based association. */
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

/** Mode 2: trigger OTP SMS. No DB write — just kicks off the SMS. */
export function useTriggerHitTraxOTP(kidId: string | undefined) {
  return useMutation<OTPTriggerResponse, Error, { hittraxUsername: string }>({
    mutationFn: ({ hittraxUsername }) => {
      if (!kidId) throw new Error('No kid selected');
      return triggerHitTraxOTP(kidId, hittraxUsername);
    },
  });
}

/** Mode 3: submit the SMS code to complete association. */
export function useAssociateHitTraxWithOTP(kidId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<AssociateResponse, Error, { hittraxUsername: string; otpCode: string }>({
    mutationFn: ({ hittraxUsername, otpCode }) => {
      if (!kidId) throw new Error('No kid selected');
      return associateHitTraxWithOTP(kidId, hittraxUsername, otpCode);
    },
    onSuccess: () => {
      if (kidId) void qc.invalidateQueries({ queryKey: hittraxLinkKey(kidId) });
    },
  });
}

/** Create a new HitTrax account in-app and immediately link it. */
export function useCreateHitTraxAccount(kidId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<AssociateResponse, Error, Omit<CreateHitTraxAccountInput, 'kidId'>>({
    mutationFn: (params) => {
      if (!kidId) throw new Error('No kid selected');
      return createHitTraxAccount({ kidId, ...params });
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
