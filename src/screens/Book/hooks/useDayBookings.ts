/**
 * useDayBookings — fetch all bookings for the selected calendar day in the
 * location's timezone via TanStack Query.
 *
 * RLS gives parents only their own family's rows — for v0.3 (single coach,
 * IH only) that's enough to surface the slots the parent already has booked.
 * Cross-family conflicts are guarded by the DB on insert in step 3.8.
 */

import { useQuery } from '@tanstack/react-query';

import { listDayBookings, type Booking } from '@/api/bookings';
import { useFamily } from '@/hooks/useFamily';

import { dayBoundsUtcISO } from '../utils/slots';

export function useDayBookings(
  date: string | null,
  timezone: string | null | undefined,
) {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

  return useQuery<Booking[]>({
    queryKey: ['day_bookings', tenantId, date, timezone ?? null],
    queryFn: async () => {
      const { startISO, endISO } = dayBoundsUtcISO(date as string, timezone);
      return listDayBookings(startISO, endISO);
    },
    enabled: !!tenantId && !!date,
  });
}
