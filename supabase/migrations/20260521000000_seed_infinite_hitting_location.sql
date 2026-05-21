-- =============================================================================
-- Ballpark — Seed missing Infinite Hitting location row
-- =============================================================================
-- The locations table had no row for the Infinite Hitting tenant, which caused:
--   - Portal Payments page to show "No locations found" (no Connect Stripe button)
--   - New family signups to receive primary_location_id = NULL
--   - Booking seed / coach seed FK references to dangle silently
--
-- UUID 00000000-0000-0000-0000-000000000101 is already referenced by:
--   - coaches seed (primary_location_id)
--   - coach_availability seed (location_id)
--   - bookings seed (location_id)
-- =============================================================================

INSERT INTO public.locations (
  id,
  tenant_id,
  name,
  address,
  city,
  state,
  zip,
  phone,
  timezone
)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Infinite Hitting — Dallas North',
  '5757 Alpha Rd',
  'Dallas',
  'TX',
  '75240',
  '(972) 555-0101',
  'America/Chicago'
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Backfill existing families that have primary_location_id = NULL
-- -----------------------------------------------------------------------------
UPDATE public.families
   SET primary_location_id = '00000000-0000-0000-0000-000000000101'
 WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
   AND primary_location_id IS NULL;
