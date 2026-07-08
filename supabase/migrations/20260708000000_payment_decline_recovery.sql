-- =============================================================================
-- Migration: declined payment recovery — failure tracking, pause scheduling
-- =============================================================================
-- Adds structured dunning state to memberships:
--   payment_failure_count      — incremented on each invoice.payment_failed
--   payment_pause_scheduled_at — set when failure #3 fires; cron reads this
--   payment_paused_reason      — 'voluntary' | 'payment_overdue' (NULL = not paused)
--
-- The stripe-webhook edge function increments failure_count and branches:
--   count=1 → existing dunning email
--   count=2 → escalation email (7-day warning)
--   count=3 → final-notice email + sets payment_pause_scheduled_at = now() + 24h
-- The enforce-payment-pause cron job (0 8 * * *) executes the pause when due.
-- invoice.payment_succeeded resets all counters and restores active status.
-- =============================================================================

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS payment_failure_count       INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_pause_scheduled_at  TIMESTAMPTZ          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_paused_reason       TEXT                 DEFAULT NULL;

COMMENT ON COLUMN memberships.payment_failure_count IS
  'Number of consecutive Stripe invoice failures. Reset to 0 on payment_succeeded.';

COMMENT ON COLUMN memberships.payment_pause_scheduled_at IS
  'When set, the enforce-payment-pause cron will pause this membership at or after this timestamp. Cleared when paused or payment recovers.';

COMMENT ON COLUMN memberships.payment_paused_reason IS
  'NULL = not paused. ''voluntary'' = parent-requested pause. ''payment_overdue'' = auto-paused due to failed payments.';

-- Efficient lookup for the enforce-payment-pause cron
CREATE INDEX IF NOT EXISTS memberships_pause_scheduled_idx
  ON memberships (payment_pause_scheduled_at)
  WHERE payment_pause_scheduled_at IS NOT NULL;

-- Efficient lookup for portal sidebar badge: payment_overdue paused members
CREATE INDEX IF NOT EXISTS memberships_payment_paused_reason_idx
  ON memberships (payment_paused_reason)
  WHERE payment_paused_reason = 'payment_overdue';
