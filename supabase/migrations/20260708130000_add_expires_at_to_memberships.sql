-- Add expires_at to memberships table.
-- Used by OTC session packs to track expiry dates.
-- Missing column caused getOwnerMembers() to crash and return [] on every load.

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.memberships.expires_at IS
  'For OTC / session-pack memberships: the date after which unused sessions are forfeited. NULL for EFT (recurring) plans.';
