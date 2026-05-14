-- =============================================================================
-- Ballpark — task #185: Store HitTrax FacilityID per tenant
-- =============================================================================
-- Adds hittrax_facility_id (nullable text) to the tenants table so each
-- franchise location can configure its own FacilityID independently, without
-- touching global Edge Function secrets.
--
-- Seeds the known value for Infinite Hitting (tenant 00000000-…-0001).
-- hittrax-poll reads this column via the admin client and passes it as the
-- FacilityID query param in GetAvailableThirdPartyData when non-null.
-- If NULL, polling proceeds without the param (graceful degradation).
-- =============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS hittrax_facility_id text;

-- Seed Infinite Hitting's known FacilityID.
UPDATE public.tenants
   SET hittrax_facility_id = '6514'
 WHERE id = '00000000-0000-0000-0000-000000000001';
