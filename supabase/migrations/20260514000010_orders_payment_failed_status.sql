-- =============================================================================
-- Add 'payment_failed' and 'payment_pending' statuses + failure_reason column
-- =============================================================================
-- 'payment_pending' — order created when Stripe PaymentIntent is created;
--   transitions to 'fulfilled' on PI confirmation (payment confirmed, item
--   ready for front-desk pickup), 'payment_failed' on hard failure, or
--   'cancelled' on PI cancellation (user dismissed payment sheet).
-- 'payment_failed'  — Stripe reported a hard failure; visible in portal.
-- 'failure_reason'  — human-readable Stripe decline message, stored so
--   portal can show actionable "Card declined: insufficient funds" text.
-- =============================================================================

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('payment_pending', 'ordered', 'fulfilled', 'cancelled', 'refunded', 'payment_failed'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS failure_reason text;
