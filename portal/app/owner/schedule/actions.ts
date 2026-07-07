'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import type { ScheduleBooking } from '@/lib/supabase/ownerQueries';

export type FetchScheduleResult = {
  bookings: ScheduleBooking[];
  waitlistByHour: Record<string, number>;
};

function localHourLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

export async function fetchScheduleRange(
  rangeStart: string,
  rangeEnd: string,
): Promise<FetchScheduleResult> {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';

  if (!tenantId) throw new Error('No authenticated session — cannot fetch schedule');

  const [bookingRes, waitlistRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, scheduled_start, scheduled_end, cage_number, status,
        session_types(name),
        kids(first_name, last_name),
        coaches(first_name, last_name)
      `)
      .eq('tenant_id', tenantId)
      .gte('scheduled_start', rangeStart)
      .lte('scheduled_start', rangeEnd)
      .order('scheduled_start'),
    supabase
      .from('booking_waitlist')
      .select('scheduled_start')
      .eq('tenant_id', tenantId)
      .in('status', ['waiting', 'notified'])
      .gte('scheduled_start', rangeStart)
      .lte('scheduled_start', rangeEnd),
  ]);

  if (bookingRes.error) {
    console.error('[fetchScheduleRange] error:', bookingRes.error.message);
    return { bookings: [], waitlistByHour: {} };
  }

  const bookings: ScheduleBooking[] = (bookingRes.data ?? []).map(b => {
    const kid   = b.kids as unknown as { first_name: string; last_name: string | null } | null;
    const coach = b.coaches as unknown as { first_name: string; last_name: string | null } | null;
    const st    = b.session_types as unknown as { name: string } | null;
    return {
      id:             b.id,
      kidName:        kid   ? [kid.first_name,   kid.last_name].filter(Boolean).join(' ')   : 'Unknown',
      coachName:      coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') : '—',
      scheduledStart: b.scheduled_start,
      scheduledEnd:   b.scheduled_end ?? b.scheduled_start,
      cage:           b.cage_number ? `Cage ${b.cage_number}` : null,
      sessionType:    st?.name ?? 'Private',
      status:         b.status,
    };
  });

  const waitlistByHour: Record<string, number> = {};
  for (const row of waitlistRes.data ?? []) {
    const lbl = localHourLabel(row.scheduled_start);
    waitlistByHour[lbl] = (waitlistByHour[lbl] ?? 0) + 1;
  }

  return { bookings, waitlistByHour };
}

export async function assignCageAction(
  bookingId: string,
  cageNumber: number | null,
): Promise<{ error?: string }> {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('bookings')
    .update({ cage_number: cageNumber })
    .eq('id', bookingId);
  if (error) {
    console.error('[assignCageAction] error:', error.message);
    return { error: error.message };
  }
  return {};
}
