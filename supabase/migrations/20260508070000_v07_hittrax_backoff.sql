-- =============================================================================
-- v0.7 task #118 — Per-link transient-failure backoff for the HitTrax poller.
-- =============================================================================
-- Adds two columns to kid_capture_links so the poll worker can implement
-- exponential backoff on transient failures (HitTrax timeout / unreachable /
-- 5xx / parse drift) per link, without starving healthy links:
--
--   retry_count  : 0 on success; ++1 on every transient failure. Cleared on
--                  the first successful poll. Used to compute the backoff
--                  delay (capped at 30 minutes).
--   next_poll_at : NULL when the link is poll-eligible right now. Set to a
--                  future timestamp by the worker after a transient failure;
--                  cleared on success. The poll-eligibility filter is
--                  `next_poll_at IS NULL OR next_poll_at <= now()`.
--
-- The 2-minute pg_cron tick still fires; backoff means a backed-off link is
-- silently skipped on ticks where it's not eligible. Healthy links continue
-- to poll on every tick.
-- =============================================================================

ALTER TABLE public.kid_capture_links
  ADD COLUMN IF NOT EXISTS retry_count  integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_poll_at timestamptz;

-- Replace the cursor index so the worker can cheaply select eligible links.
DROP INDEX IF EXISTS idx_kid_capture_links_poll_cursor;
CREATE INDEX idx_kid_capture_links_poll_cursor
  ON public.kid_capture_links(association_status, next_poll_at NULLS FIRST, last_polled_at NULLS FIRST)
  WHERE association_status = 'active';
