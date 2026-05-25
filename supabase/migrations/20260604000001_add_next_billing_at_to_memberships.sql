-- Patch: add next_billing_at to memberships if it was not applied by the
-- Phase 3 billing migration (20260515000000_subscription_billing_phase3.sql).
-- The cancel_membership() RPC reads this column; without it the RPC throws
-- "record v_mem has no field next_billing_at" [42703].
-- Safe to run even if the column already exists (IF NOT EXISTS guard).

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS next_billing_at timestamptz;
