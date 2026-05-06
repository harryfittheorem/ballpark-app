/**
 * Date helpers — keep timezone-sensitive logic in one place so we don't
 * accidentally mix UTC and local-date math when comparing against
 * Postgres `date` columns (which are timezone-naïve YYYY-MM-DD strings).
 */

/**
 * Today's date in the device's LOCAL timezone, formatted as `YYYY-MM-DD`.
 *
 * `new Date().toISOString().slice(0, 10)` returns the UTC date, which can
 * be off-by-one from the user's perspective: a parent in Pacific time on
 * May 6 evening would already be May 7 in UTC, so an assignment due
 * 2026-05-07 would incorrectly land in "Upcoming" instead of "Due now".
 * This helper builds the date from local components instead.
 */
export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
