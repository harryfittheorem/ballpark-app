/**
 * Extract a human-readable message from anything thrown — including the
 * non-Error objects supabase-js / postgrest-js return.
 *
 * Supabase's `PostgrestError` and `AuthError` are plain objects with
 * `{ message, code, details, hint }` and do NOT pass `instanceof Error`.
 * A naive `err instanceof Error ? err.message : 'Unknown error'` therefore
 * swallows them. This helper walks the most informative fields in order
 * and only falls back to a JSON dump as a last resort.
 */
export function errorMessage(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;

  if (typeof err === 'object') {
    const e = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error_description?: unknown;
    };

    const parts: string[] = [];
    if (typeof e.message === 'string' && e.message.trim()) parts.push(e.message.trim());
    else if (typeof e.error_description === 'string' && e.error_description.trim())
      parts.push(e.error_description.trim());

    if (typeof e.details === 'string' && e.details.trim() && !parts.includes(e.details.trim()))
      parts.push(e.details.trim());
    if (typeof e.hint === 'string' && e.hint.trim()) parts.push(`(hint: ${e.hint.trim()})`);
    if (typeof e.code === 'string' && e.code.trim()) parts.push(`[${e.code.trim()}]`);

    if (parts.length) return parts.join(' ');

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return String(err);
}
