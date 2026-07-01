-- =============================================================================
-- Migration: add payment_failed_at to memberships
-- =============================================================================
-- Tracks the timestamp of the most recent Stripe invoice payment failure.
-- Set by stripe-webhook on invoice.payment_failed.
-- Cleared by stripe-webhook on invoice.payment_succeeded, and by
-- save-payment-method after the parent updates their card.
-- Indexed for efficient portal queries on at-risk members.
-- =============================================================================

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS memberships_payment_failed_at_idx
  ON memberships (payment_failed_at)
  WHERE payment_failed_at IS NOT NULL;

COMMENT ON COLUMN memberships.payment_failed_at IS
  'Timestamp of the most recent Stripe invoice payment failure. NULL when no failure is outstanding.';
