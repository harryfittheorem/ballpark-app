-- =============================================================================
-- Ballpark — Phase 2, Step 3: booking location validation trigger
-- =============================================================================
-- A BEFORE INSERT trigger on public.bookings that enforces the
-- allow_cross_location_booking flag from tenant_config.
--
-- When the flag is false, a booking whose location_id differs from the
-- family's primary_location_id is rejected with a descriptive error.
--
-- Key properties:
--   - Only fires on INSERT (existing bookings are never touched).
--   - Reads tenant_config directly; no extra index needed (unique on tenant_id).
--   - Resolves family via kid_id → kids.family_id → families.primary_location_id.
--   - When tenant_config row is missing it defaults to allow = false (safe).
--   - Exception message uses a machine-readable code for client handling.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_booking_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_primary_location_id uuid;
  v_allow_cross               boolean;
BEGIN
  -- Resolve the family's primary location via kid.
  SELECT f.primary_location_id
    INTO v_family_primary_location_id
    FROM public.kids k
    JOIN public.families f ON f.id = k.family_id
   WHERE k.id = NEW.kid_id;

  -- Read the tenant flag (default false if config row is missing).
  SELECT allow_cross_location_booking
    INTO v_allow_cross
    FROM public.tenant_config
   WHERE tenant_id = NEW.tenant_id;

  v_allow_cross := COALESCE(v_allow_cross, false);

  -- If cross-location is not allowed and the booking is at a different
  -- location from the family's primary, reject it.
  IF NOT v_allow_cross
     AND v_family_primary_location_id IS NOT NULL
     AND NEW.location_id IS DISTINCT FROM v_family_primary_location_id
  THEN
    RAISE EXCEPTION 'cross_location_booking_not_allowed: booking location % differs from family primary location %',
      NEW.location_id, v_family_primary_location_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_booking_location() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.validate_booking_location() FROM public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Trigger
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_validate_booking_location
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_location();


-- =============================================================================
-- VALIDATION QUERIES
-- =============================================================================
-- 1. Insert a booking at a different location for a family whose primary is
--    location A → should raise 'cross_location_booking_not_allowed'.
--
-- 2. Set allow_cross_location_booking = true for the tenant, re-try the same
--    insert → should succeed.
--
-- 3. Insert a booking whose location matches the family's primary → should
--    always succeed regardless of the flag.
--
-- ROLLBACK (to disable trigger without touching the function):
--   DROP TRIGGER IF EXISTS trg_validate_booking_location ON public.bookings;
-- =============================================================================
