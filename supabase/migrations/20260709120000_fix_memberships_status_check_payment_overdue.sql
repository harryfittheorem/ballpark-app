-- ============================================================
-- Fix: memberships_status_check was missing 'payment_overdue'
-- ============================================================
-- Migration 20260515000000_subscription_billing_phase3.sql was recorded as
-- applied in supabase_migrations.schema_migrations, but the live constraint
-- on production only allowed ('active','paused','cancelled') — missing
-- 'payment_overdue'. This silently broke every dunning/failed-payment write
-- (stripe-webhook, collect-scheduled-charges, enforce-payment-pause all
-- write status='payment_overdue') since the check constraint rejected the
-- UPDATE and the calling code did not check/log the error.
--
-- This migration is idempotent: it re-derives whatever check constraint
-- currently exists on memberships.status and replaces it with the correct
-- set, regardless of how it drifted.
-- ────────────────────────────────────────────────────────────

DO $$ DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.memberships'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF c_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.memberships DROP CONSTRAINT ' || quote_ident(c_name);
  END IF;
END $$;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_status_check
    CHECK (status IN ('active', 'paused', 'cancelled', 'payment_overdue'));
