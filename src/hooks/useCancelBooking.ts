/**
 * useCancelBooking — TanStack mutation that soft-cancels a booking.
 *
 * On success it invalidates `['family_bookings', ...]` (so the Bookings list
 * moves the row from Upcoming to Past with a "Cancelled" badge),
 * `['booking', bookingId]` (so the detail screen re-renders with the
 * cancelled state), `['day_bookings', ...]` (so the Book tab time picker
 * frees the slot back up), and the `upcomingSessionKey(...)` prefix
 * (`['upcoming-session']`) so the Home "Up Next" card re-fetches and either
 * drops the cancelled session or rolls forward to the next one — without a
 * pull-to-refresh. The kid id isn't on the booking row we get back, so we
 * invalidate by prefix to cover every kid in the family.
 *
 * Session-credit restoration: if `scheduledStart` is provided and the
 * session is in the future, `restore_session_credit` is called so OTC
 * pack holders get their credit back.  Restoration is best-effort —
 * failure does NOT block the cancel.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancelBooking, type Booking } from '@/api/bookings';
import { restoreSessionCredit } from '@/api/memberships';
import { activeMembershipKey } from '@/hooks/useActiveMembership';
import { useFamily } from '@/hooks/useFamily';

export type CancelBookingInput = {
  bookingId: string;
  reason?: string;
  /** ISO timestamp of the session — when provided and in the future, restores 1 credit for OTC packs. */
  scheduledStart?: string;
  /** kid_id — used to invalidate the active_membership cache key. */
  kidId?: string;
};

export function useCancelBooking() {
  const qc = useQueryClient();
  const { kids } = useFamily();
  const defaultKidId = kids[0]?.id ?? '';

  return useMutation<Booking, Error, CancelBookingInput>({
    mutationFn: async ({ bookingId, reason, scheduledStart }) => {
      const booking = await cancelBooking(bookingId, reason);

      // Restore credit for future sessions only (best-effort)
      const isFuture = scheduledStart
        ? new Date(scheduledStart) > new Date()
        : false;

      if (isFuture) {
        await restoreSessionCredit(bookingId).catch(() => undefined);
      }

      return booking;
    },
    onSuccess: (booking, { kidId }) => {
      void qc.invalidateQueries({ queryKey: ['family_bookings'] });
      void qc.invalidateQueries({ queryKey: ['booking', booking.id] });
      void qc.invalidateQueries({ queryKey: ['day_bookings'] });
      void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
      const kid = kidId ?? defaultKidId;
      if (kid) {
        void qc.invalidateQueries({ queryKey: activeMembershipKey(kid) });
      }
    },
  });
}
