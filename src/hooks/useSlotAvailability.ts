/**
 * useSlotAvailability — fetch capacity-check data for a specific day +
 * session type from the SECURITY DEFINER `get_day_slot_availability` RPC.
 *
 * Returns a Map<session_slot_key, SlotAvailability> so callers can do O(1)
 * lookups per slot. Enabled for all session type categories so capacity
 * can be shown on every slot chip in the booking flow.
 */

import { useQuery } from '@tanstack/react-query';

import { getDaySlotAvailability, type SlotAvailability } from '@/api/waitlist';
import { useFamily } from '@/hooks/useFamily';
import { dayBoundsUtcISO } from '@/screens/Book/utils/slots';

export function useSlotAvailability(
  date: string | null,
  sessionTypeId: string | null,
  _sessionTypeCategory: string | null,
  timezone: string | null | undefined,
) {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

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
    enabled: !!tenantId && !!date && !!sessionTypeId,
    staleTime: 30_000,
  });
}
