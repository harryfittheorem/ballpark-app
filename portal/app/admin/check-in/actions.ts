'use server';

import { schedulingActor } from '@/lib/scheduling';
import type { CheckInBooking } from './CheckInBoard';

export type CheckInRpcResult =
  | { ok: true; data: { id: string; status: string; attended_at: string | null; cage_number: string | null; actual_coach_id: string | null } }
  | { ok: false; message: string };

async function callAttendance(bookingId: string, action: string, actualCoachId?: string, reason?: string): Promise<CheckInRpcResult> {
  try {
    const { client } = await schedulingActor();
    const { data, error } = await client.rpc('record_booking_attendance', {
      p_booking_id: bookingId, p_action: action, p_actual_coach_id: actualCoachId || null, p_reason: reason || null,
    });
    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Check-in failed.' };
  }
}

export async function fetchCheckInRoster(start: string, end: string): Promise<CheckInBooking[]> {
  const { client } = await schedulingActor();
  const { data, error } = await client.rpc('get_staff_checkin_roster', { p_start: start, p_end: end });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCheckInWaitlistCounts(start: string, end: string) {
  const { client, tenantId } = await schedulingActor();
  const { data, error } = await client.from('booking_waitlist').select('scheduled_start')
    .eq('tenant_id', tenantId).in('status', ['waiting', 'notified'])
    .gte('scheduled_start', start).lt('scheduled_start', end);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const date = new Date(row.scheduled_start);
    const hour = date.getHours();
    const label = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([hour_label, count]) => ({ hour_label, count }));
}

export async function fetchCheckInInstructors(locationId: string): Promise<{id: string; first_name: string; last_name: string | null}[]> {
  const { client } = await schedulingActor();
  const { data, error } = await client.rpc('get_checkin_instructors', { p_location_id: locationId });
  if (error) throw error;
  return data ?? [];
}

export async function checkInBookingAction(bookingId: string, actualCoachId?: string) {
  return callAttendance(bookingId, 'checkin', actualCoachId);
}
export async function correctInstructorAction(bookingId: string, actualCoachId: string, reason: string) {
  return callAttendance(bookingId, 'correct', actualCoachId, reason);
}
export async function markNoShowAction(bookingId: string) { return callAttendance(bookingId, 'noshow'); }
export async function undoCheckInAction(bookingId: string) { return callAttendance(bookingId, 'undo'); }
