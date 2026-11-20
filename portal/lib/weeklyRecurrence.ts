/** Build explicit instants at the same device-local wall time each week.
 * Date arithmetic (not a fixed 168-hour interval) preserves DST changes.
 */
export function weeklyRecurrenceStarts(localStart: string, count: number): string[] {
  const start = new Date(localStart);
  if (!Number.isFinite(start.getTime())) throw new Error('Choose a valid first lesson date and time.');
  if (!Number.isInteger(count) || count < 2 || count > 52) throw new Error('Choose 2–52 weekly occurrences.');
  return Array.from({ length: count }, (_, index) => {
    const occurrence = new Date(start);
    occurrence.setDate(start.getDate() + index * 7);
    return occurrence.toISOString();
  });
}
