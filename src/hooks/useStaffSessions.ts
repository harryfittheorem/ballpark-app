/**
 * Hook for the staff mobile check-in board.
 *
 * Fetches today's bookings from Supabase and maintains a Realtime subscription
 * so concurrent check-ins (from the portal or another device) are reflected
 * within a few seconds without a manual refresh.
 *
 * `coachId` — when provided, filters to that coach's own bookings (instructor
 * view). When null/undefined, returns all tenant bookings (admin / staff-coach
 * view). The server-side RLS + `check_in_booking` RPC enforce the authority
 * at write time regardless of what we fetch here.
 *
 * Design notes
 * ────────────
 * • `key` is kept in a `useRef` so the realtime callback and `mutate` always
 *   read the *current* key rather than a stale closure captured at mount. This
 *   matters for coaches: the query key starts as `['staff-sessions','all']`
 *   while the coach row is loading, then switches to `['staff-sessions', id]`.
 *   Without the ref, cache patches would target the wrong key.
 * • The realtime `useEffect` depends on `coachId` so Supabase resubscribes
 *   (and the closure re-captures the latest ref value) whenever the key changes.
 * • The query is disabled for coaches until `coachId` resolves so we never
 *   issue an unfiltered tenant-wide fetch on their behalf.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

import { supabase } from '@/lib/supabase';
import {
  getTodayStaffBookings,
  checkInBookingRpc,
  markNoShowRpc,
  undoCheckInRpc,
  type StaffBooking,
} from '@/api/bookings';
import { errorMessage } from '@/utils/error';

export type StaffBookingWithPending = StaffBooking & {
  pending?: 'checkin' | 'noshow' | 'undo';
};

/** True when a coach has no coachId yet (coach row is still loading). */
type CoachIdState = string | null | undefined;

function staffSessionsKey(coachId: CoachIdState, actorId?: string) {
  return ['staff-sessions', actorId, coachId ?? 'all'] as const;
}

export function isWithinUndoWindow(b: StaffBooking): boolean {
  if (!b.attended_at || b.status !== 'completed') return false;
  return Date.now() - new Date(b.attended_at).getTime() < 5 * 60 * 1000;
}

/**
 * @param coachId - UUID of the coach row when the caller is a coach;
 *   undefined/null for admins (full tenant view).
 * @param isCoach - true when the caller has app_role='coach'. When true and
 *   coachId is still undefined (coach row loading), the query is disabled so
 *   we don't accidentally fetch unfiltered bookings on a coach's behalf.
 */
export function useStaffSessions(coachId: CoachIdState, isCoach = false) {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Always-current key ref — closures in realtime and mutate read this, not
  // a captured snapshot from their creation time.
  const keyRef = useRef(staffSessionsKey(coachId, user?.id));
  keyRef.current = staffSessionsKey(coachId, user?.id);

  const queryEnabled = !!user && (isCoach ? !!coachId : true);

  const { data: fetchedBookings, isPending, isError, error, refetch } = useQuery({
    queryKey: keyRef.current,
    queryFn: () => getTodayStaffBookings(),
    enabled: queryEnabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Local overlay to merge optimistic pending flags on top of server data.
  const [pending, setPending] = useState<Record<string, StaffBookingWithPending['pending']>>({});

  const bookings: StaffBookingWithPending[] = (fetchedBookings ?? []).map((b) => ({
    ...b,
    pending: pending[b.id],
  }));

  // Realtime subscription — mirrors portal CheckInBoard behaviour.
  // Depends on `coachId` so it resubscribes (and picks up the new keyRef
  // value) whenever the coach row resolves.
  useEffect(() => {
    if (isCoach && !coachId) return; // wait until we know which coach to scope

    const channel = supabase
      .channel(`mobile-checkin-bookings-${coachId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          // Inserts need joined names; deletes may only contain an old key.
          // Refetch the authorized projection rather than patching known rows.
          void qc.invalidateQueries({ queryKey: keyRef.current });
        },
      )
      .subscribe(status => { if (status === 'SUBSCRIBED') void qc.invalidateQueries({ queryKey: keyRef.current }); });
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void qc.invalidateQueries({ queryKey: keyRef.current });
    });

    return () => { listener.remove(); void supabase.removeChannel(channel); };
  }, [coachId, isCoach, qc, user?.id]);

  const mutate = useCallback(
    async (
      action: 'checkin' | 'noshow' | 'undo',
      bookingId: string,
      actualCoachId?: string,
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      setPending((p) => ({ ...p, [bookingId]: action }));

      try {
        let updated: StaffBooking;
        if (action === 'checkin') updated = await checkInBookingRpc(bookingId, actualCoachId);
        else if (action === 'noshow') updated = await markNoShowRpc(bookingId);
        else updated = await undoCheckInRpc(bookingId);

        // Optimistic patch: immediately flip status in cache so the row
        // re-renders without waiting for the network round-trip.
        qc.setQueryData<StaffBooking[]>(keyRef.current, (prev) => {
          if (!prev) return prev;
          return prev.map((b) =>
            b.id === bookingId
              ? { ...b, status: updated.status, attended_at: updated.attended_at, actual_coach_id: updated.actual_coach_id }
              : b,
          );
        });

        // Guaranteed sync: invalidate so TanStack Query immediately refetches
        // from Supabase, ensuring the UI reflects the true DB state even if
        // the optimistic patch above didn't trigger a re-render.
        void qc.invalidateQueries({ queryKey: keyRef.current });

        setPending((p) => {
          const next = { ...p };
          delete next[bookingId];
          return next;
        });

        return { ok: true };
      } catch (err) {
        setPending((p) => {
          const next = { ...p };
          delete next[bookingId];
          return next;
        });
        return { ok: false, message: errorMessage(err) };
      }
    },
    [qc],  // keyRef is a stable ref object — no need to list it
  );

  return {
    bookings,
    isPending: isCoach && !coachId ? true : isPending,
    isError,
    error,
    refetch,
    mutate,
  };
}
