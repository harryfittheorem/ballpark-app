/**
 * UUID v4 generator that works in React Native (where `crypto.randomUUID`
 * isn't always available across Hermes / iOS / Android consistently).
 *
 * Used for client-generated `Idempotency-Key` headers so a flaky upload
 * retry hits the same server-side row instead of creating a duplicate.
 *
 * Not security-sensitive — `Math.random` is fine for idempotency tokens.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
