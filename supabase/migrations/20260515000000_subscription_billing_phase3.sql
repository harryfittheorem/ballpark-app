-- ============================================================
-- Task #189: Stripe Connect Phase 3 — Recurring Subscription Billing
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add payment_overdue to memberships status enum
--    The inline CHECK constraint must be dropped and recreated.
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

-- ────────────────────────────────────────────────────────────
-- 2. Add stripe_invoice_id to payment_events for idempotency
--    NOTE: NOT unique — one invoice can produce both a failed
--    row (attempt 1) and a paid row (successful retry).
--    Idempotency is handled at the application layer by checking
--    (stripe_invoice_id, status) before inserting.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text;

-- If a unique index was created by a previous migration version, drop it first
DROP INDEX IF EXISTS payment_events_stripe_invoice_id_uniq;

-- Non-unique index for fast lookups by invoice
CREATE INDEX IF NOT EXISTS payment_events_stripe_invoice_id_idx
  ON public.payment_events (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. Ensure stripe_subscription_id exists on memberships
--    (already added in the initial schema, but guard for safety)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS memberships_stripe_sub_idx
  ON public.memberships (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. Track next billing date for portal display
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS next_billing_at timestamptz;

-- ────────────────────────────────────────────────────────────
-- 5. Canonical Stripe Price ID per membership plan
--    Stored on first subscription activation; reused on every
--    subsequent activation to avoid Stripe price sprawl and
--    ensure consistent plan→Price mapping in Stripe reporting.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- cancel_at: when cancel_at_period_end=true, Stripe returns the timestamp of
-- the next period boundary when the subscription will terminate. Persisting this
-- lets the portal display a consistent "Cancels on <date>" badge across page
-- reloads without re-querying Stripe.
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS cancel_at timestamptz;

-- ────────────────────────────────────────────────────────────
-- 6. Separate customer IDs for platform vs connected accounts
--    families.stripe_customer_id → platform-account customer
--      (used by stripe-create-payment-intent for store checkout)
--    families.stripe_connected_customer_id → connected-account customer
--      (used by stripe-setup-intent + stripe-create-subscription
--       for EFT membership subscriptions on the location account)
--    Keeping them in separate columns prevents a connected-account
--    customer ID from being passed to platform-account API calls
--    (which would cause "No such customer" errors).
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS stripe_connected_customer_id text;
