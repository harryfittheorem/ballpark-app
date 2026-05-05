/**
 * Tiny relative-time helper used by the coach Sent Videos list (Step 4.11),
 * the parent Home tab's coach video card (Step 4.12), and any other
 * "when did this happen" UI we add later.
 *
 * Intentionally framework-free — no date-fns / moment / luxon dependency.
 * Buckets are aligned with the v0.4 design spec:
 *   < 60s     -> "Just now"
 *   < 60m     -> "Nm ago"
 *   < 24h     -> "Nh ago"
 *   = 1 day   -> "Yesterday"
 *   < 7 days  -> "N days ago"
 *   else      -> "MMM d" (e.g. "Mar 14")
 *
 * Future timestamps (clock skew, optimistic inserts dated forward) are
 * clamped to "Just now" so the UI never renders e.g. "-3m ago".
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export function formatRelativeTime(
  input: Date | string | number,
  now: Date = new Date(),
): string {
  const d = input instanceof Date ? input : new Date(input);
  const diffMs = now.getTime() - d.getTime();
  if (Number.isNaN(diffMs)) return '';
  if (diffMs < 60_000) return 'Just now';

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;

  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
