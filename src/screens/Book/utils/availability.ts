/**
 * Availability helpers for the Book tab date picker.
 *
 * Pure date math — no React, no Supabase. Given today's date in the
 * location's timezone, the active session type's `duration_minutes`, and
 * the tenant's `coach_availability` rows, compute which dates in the next
 * `daysAhead` window have at least one window long enough to fit the
 * session.
 *
 * Dates are represented as `YYYY-MM-DD` strings so they can be compared
 * cheaply and stored in a Set without timezone surprises.
 */

import type { CoachAvailability } from '@/api/bookings';

export type AvailabilityRow = Pick<
  CoachAvailability,
  'day_of_week' | 'start_time' | 'end_time' | 'effective_from' | 'effective_until'
>;

/** Parse a `HH:MM` or `HH:MM:SS` time string into minutes past midnight. */
function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(':');
  return Number(hh) * 60 + Number(mm);
}

/** Format a Date's UTC components as YYYY-MM-DD. */
function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Today's date (YYYY-MM-DD) in the given IANA timezone. Falls back to the
 * device timezone if `timezone` is empty or invalid.
 */
export function todayInTimezone(timezone: string | null | undefined): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA yields YYYY-MM-DD already.
    return fmt.format(new Date());
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Build a list of `count` consecutive YYYY-MM-DD strings starting at
 * `startYmd` (inclusive). Calendar days only — no timezone shifts because
 * we step by adding 1 day to a UTC-noon anchor.
 */
export function buildDateRange(startYmd: string, count: number): string[] {
  const [y, m, d] = startYmd.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
    out.push(formatYmd(dt));
  }
  return out;
}

/**
 * Day-of-week (0 = Sunday … 6 = Saturday) for a YYYY-MM-DD string,
 * computed from a UTC-noon anchor so local timezone never flips it.
 */
export function dayOfWeekUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
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
 * Compute the set of dates in the upcoming window that have at least one
 * coach_availability row long enough for `durationMinutes`.
 *
 * @returns the date range used (as YYYY-MM-DD strings), today's date in
 *   the supplied timezone, and the set of available dates within the range.
 */
export function computeAvailableDates(opts: {
  durationMinutes: number;
  rows: AvailabilityRow[];
  timezone: string | null | undefined;
  daysAhead?: number;
}): {
  today: string;
  range: string[];
  availableDates: Set<string>;
} {
  const daysAhead = opts.daysAhead ?? 30;
  const today = todayInTimezone(opts.timezone);
  const range = buildDateRange(today, daysAhead);

  // Pre-bucket rows by day_of_week and keep only those long enough.
  const buckets: AvailabilityRow[][] = Array.from({ length: 7 }, () => []);
  for (const row of opts.rows) {
    const len = timeToMinutes(row.end_time) - timeToMinutes(row.start_time);
    if (len >= opts.durationMinutes) {
      buckets[row.day_of_week]?.push(row);
    }
  }

  const availableDates = new Set<string>();
  for (const ymd of range) {
    const dow = dayOfWeekUtc(ymd);
    const candidates = buckets[dow];
    if (!candidates || candidates.length === 0) continue;
    for (const row of candidates) {
      if (isWithinEffectiveWindow(ymd, row.effective_from, row.effective_until)) {
        availableDates.add(ymd);
        break;
      }
    }
  }

  return { today, range, availableDates };
}
