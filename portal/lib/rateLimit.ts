/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Works per-deployment-instance (not cross-process). Appropriate as a
 * first-line defence for low-traffic sensitive endpoints (setup, invite,
 * claim). A distributed Redis-backed limiter can replace this for scale.
 */

const windows = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * @param key        — usually `${ip}:${endpoint}`
 * @param maxRequests — max hits allowed in the window
 * @param windowMs   — sliding window length in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const prev = windows.get(key) ?? [];
  const hits = prev.filter((t) => t > windowStart);

  if (hits.length >= maxRequests) {
    const oldest = hits[0]!;
    const retryAfterMs = oldest + windowMs - now;
    return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }

  hits.push(now);
  windows.set(key, hits);

  // Prevent unbounded Map growth — prune entries older than 2× the window.
  if (windows.size > 5000) {
    const cutoff = now - windowMs * 2;
    for (const [k, ts] of windows.entries()) {
      if (!ts.some((t) => t > cutoff)) windows.delete(k);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Extract the best-effort client IP from a Next.js Route Handler request.
 * Falls back to "unknown" so callers always get a string.
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return 'unknown';
}
