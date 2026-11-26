/**
 * Integer money and ratio helpers for Meta reporting.
 * Missing inputs stay null. A verified zero is a real zero.
 * Ratios are recomputed from summed numerators and denominators.
 */

const MINOR_EXPONENTS: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, NZD: 2, MXN: 2,
  JPY: 0, KRW: 0,
  BHD: 3, KWD: 3, OMR: 3,
};

export function minorExponent(currency: string | null | undefined): number | null {
  if (!currency) return null;
  const exp = MINOR_EXPONENTS[currency.toUpperCase()];
  return exp === undefined ? null : exp;
}

/** Parse a Graph decimal string into integer minor units. Null when the value or currency exponent is unknown. */
export function toMinorUnits(value: unknown, currency: string | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const exp = minorExponent(currency);
  if (exp === null) return null;
  const negative = text.startsWith('-');
  const [whole, frac = ''] = text.replace('-', '').split('.');
  const padded = frac + '0'.repeat(exp + 1);
  const digits = padded.slice(0, exp);
  const roundDigit = padded.slice(exp, exp + 1);
  const minor = Number(whole) * 10 ** exp + (digits === '' ? 0 : Number(digits));
  if (!Number.isSafeInteger(minor)) return null;
  const rounded = roundDigit >= '5' ? minor + 1 : minor;
  return negative ? -rounded : rounded;
}

/** Counts and action values. Null when the field is absent or not a finite number. Never coerces missing to 0. */
export function parseCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

/**
 * Sum additive numbers. Any null poisons the sum (unknown is not zero).
 * An empty list is a verified zero for metrics Meta omits by leaving the row out,
 * or null for leads, where an absent typed action is "unavailable".
 */
export function sumNumbers(values: Array<number | null>, empty: 'zero' | 'null'): number | null {
  if (values.length === 0) return empty === 'zero' ? 0 : null;
  if (values.some((value) => value === null)) return null;
  return (values as number[]).reduce((total, value) => total + value, 0);
}

/** Null when either side is null or the denominator is 0. A zero numerator with a positive denominator is 0. */
export function ratioFromSums(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function unifyCurrency(currencies: Array<string | null>): string | null {
  const present = currencies.filter((currency): currency is string => Boolean(currency));
  if (present.length === 0) return null;
  const first = present[0];
  return present.every((currency) => currency === first) ? first : null;
}

export function formatMinor(amount: number | null, currency: string | null): string {
  if (amount === null || !currency) return 'unavailable';
  const exp = minorExponent(currency);
  if (exp === null) return 'unavailable';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(amount / 10 ** exp);
  } catch {
    return 'unavailable';
  }
}

export function formatCount(value: number | null): string {
  if (value === null) return 'unavailable';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return 'unavailable';
  return `${(ratio * 100).toFixed(2)}%`;
}

export function formatFrequency(value: number | null): string {
  if (value === null) return 'unavailable';
  return value.toFixed(2);
}

export function formatIsoDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'unavailable';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function parseIsoDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return value;
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function inclusiveDayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function formatDateInTimeZone(now: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/** Yesterday's calendar date in the ad account timezone. */
export function yesterdayInTimeZone(timeZone: string, now = new Date()): string | null {
  const today = formatDateInTimeZone(now, timeZone);
  if (!today) return null;
  return addIsoDays(today, -1);
}

export function completePresetWindow(days: number, timeZone: string, now = new Date()): { from: string; to: string } | null {
  const to = yesterdayInTimeZone(timeZone, now);
  if (!to) return null;
  return { from: addIsoDays(to, -(days - 1)), to };
}

export function windowIncludesOpenDay(to: string, lastComplete: string | null): boolean {
  if (!lastComplete) return false;
  return to > lastComplete;
}

export function resolveWindow(input: {
  preset: string | null;
  from: string | null;
  to: string | null;
  timeZone: string | null;
  now?: Date;
}): { from: string; to: string; usedUtcFallback: boolean } | { error: string } {
  if (input.preset && input.preset !== 'custom') {
    if (input.preset !== '7' && input.preset !== '28' && input.preset !== '90') {
      return { error: 'Date preset must be 7, 28, or 90 days' };
    }
    const usedUtcFallback = !input.timeZone;
    const window = completePresetWindow(Number(input.preset), input.timeZone ?? 'UTC', input.now);
    if (!window) return { error: 'Could not resolve the date window' };
    return { ...window, usedUtcFallback };
  }
  const from = parseIsoDate(input.from);
  const to = parseIsoDate(input.to);
  if (!from || !to) return { error: 'Custom dates must be YYYY-MM-DD' };
  if (from > to) return { error: 'The start date must be on or before the end date' };
  if (inclusiveDayCount(from, to) > 90) return { error: 'Date range cannot exceed 90 days' };
  return { from, to, usedUtcFallback: false };
}

export function eachIsoDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  const guard = inclusiveDayCount(from, to);
  for (let i = 0; i < guard; i += 1) {
    dates.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return dates;
}
