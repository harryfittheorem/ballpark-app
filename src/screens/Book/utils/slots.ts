/**
 * Slot generation for the Book tab time picker.
 *
 * Pure date/time math — no React, no Supabase. Given a calendar date in the
 * location's timezone, the active session type's `duration_minutes`, the
 * tenant's `coach_availability` rows, and the day's existing `bookings`,
 * compute the list of free, non-overlapping start times.
 *
 * Slots are aligned to the start of each availability window and stepped by
 * `duration_minutes`. Any slot that overlaps an existing booking for the same
 * coach is removed. Slots whose start is in the past are also removed so the
 * UI never offers an unbookable time.
 */

import type { AvailabilityRow } from './availability';
import { dayOfWeekUtc } from './availability';

export type SlotBookingInput = {
  coach_id: string;
  scheduled_start: string;
  scheduled_end: string;
};

export type AvailabilityForSlots = AvailabilityRow & {
  coach_id: string;
  start_time: string;
  end_time: string;
};

export type Slot = {
  start: string; // UTC ISO timestamp
  end: string; // UTC ISO timestamp
  coach_id: string;
};

/** Parse a `HH:MM` or `HH:MM:SS` time string into minutes past midnight. */
function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(':');
  return Number(hh) * 60 + Number(mm);
}

/** `9:00 AM` style label for a UTC ISO timestamp in the given timezone. */
export function formatSlotTime(iso: string, timezone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    const d = new Date(iso);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Convert a wall-clock time (`YYYY-MM-DD` + minutes past midnight) in
 * `timezone` to a UTC ISO string. Works by computing the offset between the
 * "naive UTC" interpretation of the wall time and how that same instant
 * formats back in the target timezone.
 */
export function zonedWallTimeToUtcISO(
  ymd: string,
  minutesPastMidnight: number,
  timezone: string | null | undefined,
): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const hh = Math.floor(minutesPastMidnight / 60);
  const mm = minutesPastMidnight % 60;
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  if (!timezone) return new Date(naiveUtcMs).toISOString();

  let offsetMs = 0;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = fmt.formatToParts(new Date(naiveUtcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const hour = get('hour') % 24;
    const asUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
    offsetMs = asUtcMs - naiveUtcMs;
  } catch {
    offsetMs = 0;
  }
  return new Date(naiveUtcMs - offsetMs).toISOString();
}

function isWithinEffectiveWindow(
  ymd: string,
  effectiveFrom: string | null,
  effectiveUntil: string | null,
): boolean {
  if (effectiveFrom && ymd < effectiveFrom) return false;
  if (effectiveUntil && ymd > effectiveUntil) return false;
  return true;
}

/**
 * Generate free slots for a single calendar day.
 *
 * @param now Optional override for "right now" (used for past-slot pruning
 *   and tests). Defaults to `new Date()`.
 */
export function generateDaySlots(opts: {
  date: string;
  durationMinutes: number;
  timezone: string | null | undefined;
  availability: AvailabilityForSlots[];
  bookings: SlotBookingInput[];
  now?: Date;
}): Slot[] {
  const { date, durationMinutes, timezone, availability, bookings } = opts;
  const dow = dayOfWeekUtc(date);
  const nowMs = (opts.now ?? new Date()).getTime();

  // Pre-compute booking ranges per coach for fast overlap lookup.
  const bookingsByCoach = new Map<string, { startMs: number; endMs: number }[]>();
  for (const b of bookings) {
    const arr = bookingsByCoach.get(b.coach_id) ?? [];
    arr.push({
      startMs: new Date(b.scheduled_start).getTime(),
      endMs: new Date(b.scheduled_end).getTime(),
    });
    bookingsByCoach.set(b.coach_id, arr);
  }

  // Dedupe across availability rows that yield the same (coach_id, start).
  const seen = new Set<string>();
  const out: Slot[] = [];

  for (const row of availability) {
    if (row.day_of_week !== dow) continue;
    if (!isWithinEffectiveWindow(date, row.effective_from, row.effective_until)) continue;

    const winStart = timeToMinutes(row.start_time);
    const winEnd = timeToMinutes(row.end_time);
    if (winEnd - winStart < durationMinutes) continue;

    for (let m = winStart; m + durationMinutes <= winEnd; m += durationMinutes) {
      const startISO = zonedWallTimeToUtcISO(date, m, timezone);
      const endISO = zonedWallTimeToUtcISO(date, m + durationMinutes, timezone);
      const startMs = new Date(startISO).getTime();
      const endMs = new Date(endISO).getTime();

      if (startMs < nowMs) continue;

      const coachBookings = bookingsByCoach.get(row.coach_id);
      if (coachBookings) {
        let conflict = false;
        for (const b of coachBookings) {
          if (b.startMs < endMs && b.endMs > startMs) {
            conflict = true;
            break;
          }
        }
        if (conflict) continue;
      }

      const key = `${row.coach_id}|${startISO}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ start: startISO, end: endISO, coach_id: row.coach_id });
    }
  }

  out.sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.coach_id < b.coach_id ? -1 : a.coach_id > b.coach_id ? 1 : 0;
  });
  return out;
}

/** Distinct coach_ids present in a slot list, preserving first-seen order. */
export function uniqueCoachIds(slots: Slot[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of slots) {
    if (!seen.has(s.coach_id)) {
      seen.add(s.coach_id);
      out.push(s.coach_id);
    }
  }
  return out;
}

/**
 * Compute the UTC ISO bounds `[startISO, endISO)` for the given calendar
 * day in the location's timezone. Used to query bookings for that day.
 */
export function dayBoundsUtcISO(
  ymd: string,
  timezone: string | null | undefined,
): { startISO: string; endISO: string } {
  return {
    startISO: zonedWallTimeToUtcISO(ymd, 0, timezone),
    endISO: zonedWallTimeToUtcISO(ymd, 24 * 60, timezone),
  };
}
