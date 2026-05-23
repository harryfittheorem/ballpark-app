-- ============================================================
-- Task #233 — In-app payment method management
-- Adds four shadow display columns to the families table so
-- the mobile app can show card brand / last4 / expiry without
-- an extra Stripe API call on every render.
-- Updated by the save-payment-method Edge Function after a
-- successful Stripe SetupIntent confirmation.
-- ============================================================

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS card_last4      text,
  ADD COLUMN IF NOT EXISTS card_brand      text,
  ADD COLUMN IF NOT EXISTS card_exp_month  integer,
  ADD COLUMN IF NOT EXISTS card_exp_year   integer;

COMMENT ON COLUMN public.families.card_last4     IS 'Last 4 digits of the default card on file (shadow from Stripe)';
COMMENT ON COLUMN public.families.card_brand     IS 'Card network brand (Visa, Mastercard, etc.) — shadow from Stripe';
COMMENT ON COLUMN public.families.card_exp_month IS 'Card expiry month 1–12 — shadow from Stripe';
COMMENT ON COLUMN public.families.card_exp_year  IS 'Card expiry 4-digit year — shadow from Stripe';
