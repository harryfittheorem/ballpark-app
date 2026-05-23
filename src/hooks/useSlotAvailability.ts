/**
 * useSlotAvailability — fetch capacity-check data for a specific day +
 * session type from the SECURITY DEFINER `get_day_slot_availability` RPC.
 *
 * Returns a Map<session_slot_key, SlotAvailability> so callers can do O(1)
 * lookups per slot. Only enabled for group/cage session types (private lessons
 * don't support waitlisting per product spec).
 */

import { useQuery } from '@tanstack/react-query';

import { getDaySlotAvailability, type SlotAvailability } from '@/api/waitlist';
import { useFamily } from '@/hooks/useFamily';
import { dayBoundsUtcISO } from '@/screens/Book/utils/slots';

export function useSlotAvailability(
  date: string | null,
  sessionTypeId: string | null,
  sessionTypeCategory: string | null,
  timezone: string | null | undefined,
) {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

  // Only relevant for group / cage (not private)
  const isWaitlistable = sessionTypeCategory === 'group' || sessionTypeCategory === 'cage';

  return useQuery<Map<string, SlotAvailability>>({
    queryKey: ['slot_availability', tenantId, sessionTypeId, date, timezone ?? null],
    queryFn: async () => {
      const { startISO, endISO } = dayBoundsUtcISO(date as string, timezone);
      return getDaySlotAvailability({
        tenant_id: tenantId as string,
        session_type_id: sessionTypeId as string,
        start: startISO,
        end: endISO,
      });
    },
    enabled: !!tenantId && !!date && !!sessionTypeId && isWaitlistable,
    staleTime: 30_000,
  });
}
