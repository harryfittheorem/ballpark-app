-- =============================================================================
-- Ballpark — Phase 1a: Fix handle_new_user to honour selected location at signup
-- =============================================================================
-- Root cause: the trigger ignored the `location_id` passed in signup metadata
-- and always assigned `primary_location_id` by picking the alphabetically-first
-- location. For any tenant with more than one location this silently placed
-- every new user at the wrong facility.
--
-- Changes in this migration (function body only — no table/RLS changes):
--
--   Parent branch:
--     Before the alphabetical fallback, attempt to resolve `primary_location_id`
--     from `(NEW.raw_user_meta_data->>'location_id')::uuid`.
--     Validate: the UUID must exist in public.locations AND have a matching
--     tenant_id AND is_active = true.  If valid → use it.
--     If null/invalid/cross-tenant → fall back to alphabetical-first (unchanged).
--
--   Coach branch:
--     Apply the same metadata → validate → fallback logic to populate
--     coaches.primary_location_id (previously always left NULL).
--
-- Guards preserved:
--   - super_admin early-return (20260514000003_super_admin.sql)
--   - owner/admin NULL-branch  (20260511000001_fix_handle_new_user_owner_admin.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_slug         text;
  v_tenant_id           uuid;
  v_app_role            text;
  v_first_name          text;
  v_last_name           text;
  v_requested_loc_id    uuid;
  v_primary_location_id uuid;
BEGIN
  v_app_role := NEW.raw_user_meta_data->>'app_role';

  -- Super-admin accounts are provisioned directly; no profile rows needed.
  IF v_app_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  v_tenant_slug := NEW.raw_user_meta_data->>'tenant_slug';
  IF v_tenant_slug IS NULL OR v_tenant_slug = '' THEN
    RAISE EXCEPTION 'handle_new_user: tenant_slug missing from raw_user_meta_data';
  END IF;

  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: unknown tenant_slug %', v_tenant_slug;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Shared location resolution (runs before the coach/parent branch).
  -- Step 1: Try to parse the location_id from signup metadata.
  --         A missing or malformed value is silently treated as NULL
  --         (no exception surfaced to the user).
  -- Step 2: If parsed, validate it belongs to this tenant and is active.
  --         Cross-tenant UUIDs and inactive locations are silently rejected.
  -- Step 3: Fall back to the alphabetically-first location for the tenant
  --         when no valid location was obtained (preserves existing behaviour).
  -- ---------------------------------------------------------------------------
  BEGIN
    v_requested_loc_id := (NEW.raw_user_meta_data->>'location_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_requested_loc_id := NULL;
  END;

  IF v_requested_loc_id IS NOT NULL THEN
    SELECT id INTO v_primary_location_id
      FROM public.locations
     WHERE id        = v_requested_loc_id
       AND tenant_id = v_tenant_id
       AND is_active = true;
  END IF;

  IF v_primary_location_id IS NULL THEN
    -- Fallback: alphabetical-first location (unchanged from previous behaviour).
    SELECT id INTO v_primary_location_id
      FROM public.locations
     WHERE tenant_id = v_tenant_id
     ORDER BY name ASC
     LIMIT 1;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Branch on app_role.
  -- ---------------------------------------------------------------------------
  IF v_app_role = 'coach' THEN
    v_first_name := NEW.raw_user_meta_data->>'first_name';
    v_last_name  := NEW.raw_user_meta_data->>'last_name';
    IF v_first_name IS NULL OR v_first_name = ''
       OR v_last_name  IS NULL OR v_last_name  = '' THEN
      RAISE EXCEPTION
        'handle_new_user: app_role=coach requires first_name and last_name in raw_user_meta_data';
    END IF;

    INSERT INTO public.coaches (
      tenant_id, user_id, first_name, last_name, is_active, primary_location_id
    ) VALUES (
      v_tenant_id, NEW.id, v_first_name, v_last_name, true, v_primary_location_id
    );

  ELSIF v_app_role IN ('owner', 'admin') THEN
    -- Portal-only roles: no row needed in families or coaches.
    NULL;

  ELSE
    -- Default: parent / family.
    INSERT INTO public.families (
      tenant_id, parent_user_id, parent_first_name, parent_last_name,
      parent_phone, parent_email, primary_location_id
    ) VALUES (
      v_tenant_id, NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      NEW.raw_user_meta_data->>'phone',
      NEW.email,
      v_primary_location_id
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;


-- =============================================================================
-- VALIDATION QUERIES
-- Run these manually after applying to staging to confirm correct behaviour.
-- =============================================================================
/*

-- 1. Confirm a test signup with a known location_id produces the correct
--    primary_location_id in families.
--
--    After signing up as a parent with location_id = '<known-location-uuid>':
SELECT f.primary_location_id,
       l.name         AS location_name,
       l.tenant_id    AS location_tenant,
       f.parent_email
  FROM public.families f
  JOIN public.locations l ON l.id = f.primary_location_id
 WHERE f.parent_email = '<test-parent-email>'
   AND f.primary_location_id = '<known-location-uuid>';
-- Expected: one row with location_name matching the chosen location.

-- 2. Confirm a signup with a forged (cross-tenant) location_id produces
--    the fallback location (alphabetical-first for the target tenant).
--
--    After signing up with location_id = '<uuid-from-different-tenant>':
SELECT f.primary_location_id,
       l.name         AS location_name,
       f.parent_email
  FROM public.families f
  JOIN public.locations l ON l.id = f.primary_location_id
 WHERE f.parent_email = '<test-forged-email>';
-- Expected: primary_location_id is the alphabetical-first location of the
-- target tenant — NOT the forged cross-tenant UUID.

-- 3. Confirm a signup with no location_id (existing baked-slug path) is
--    unchanged — still gets alphabetical-first location.
--
--    After signing up without location_id in metadata:
SELECT f.primary_location_id,
       l.name         AS location_name,
       f.parent_email
  FROM public.families f
  JOIN public.locations l ON l.id = f.primary_location_id
 WHERE f.parent_email = '<test-no-location-email>';
-- Expected: primary_location_id is the alphabetical-first location for the
-- tenant (ORDER BY name ASC LIMIT 1 — same as pre-migration behaviour).

-- 4. Confirm a newly provisioned coach with a valid location_id gets
--    coaches.primary_location_id set correctly.
SELECT c.primary_location_id,
       l.name         AS location_name,
       c.first_name,
       c.last_name
  FROM public.coaches c
  JOIN public.locations l ON l.id = c.primary_location_id
 WHERE c.first_name = '<test-coach-first>'
   AND c.last_name  = '<test-coach-last>';
-- Expected: primary_location_id matches the location_id passed in metadata.

*/


-- =============================================================================
-- ROLLBACK
-- Re-apply this block to revert to the previous function body
-- (as of 20260514000003_super_admin.sql).
-- =============================================================================
/*

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_slug         text;
  v_tenant_id           uuid;
  v_app_role            text;
  v_first_name          text;
  v_last_name           text;
  v_primary_location_id uuid;
BEGIN
  v_app_role := NEW.raw_user_meta_data->>'app_role';

  -- Super-admin accounts are provisioned directly; no profile rows needed.
  IF v_app_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  v_tenant_slug := NEW.raw_user_meta_data->>'tenant_slug';
  IF v_tenant_slug IS NULL OR v_tenant_slug = '' THEN
    RAISE EXCEPTION 'handle_new_user: tenant_slug missing from raw_user_meta_data';
  END IF;

  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: unknown tenant_slug %', v_tenant_slug;
  END IF;

  IF v_app_role = 'coach' THEN
    v_first_name := NEW.raw_user_meta_data->>'first_name';
    v_last_name  := NEW.raw_user_meta_data->>'last_name';
    IF v_first_name IS NULL OR v_first_name = ''
       OR v_last_name  IS NULL OR v_last_name  = '' THEN
      RAISE EXCEPTION
        'handle_new_user: app_role=coach requires first_name and last_name in raw_user_meta_data';
    END IF;

    INSERT INTO public.coaches (tenant_id, user_id, first_name, last_name, is_active)
    VALUES (v_tenant_id, NEW.id, v_first_name, v_last_name, true);

  ELSIF v_app_role IN ('owner', 'admin') THEN
    NULL;

  ELSE
    SELECT id INTO v_primary_location_id
      FROM public.locations
     WHERE tenant_id = v_tenant_id
     ORDER BY name ASC
     LIMIT 1;

    INSERT INTO public.families (
      tenant_id, parent_user_id, parent_first_name, parent_last_name,
      parent_phone, parent_email, primary_location_id
    ) VALUES (
      v_tenant_id, NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      NEW.raw_user_meta_data->>'phone',
      NEW.email,
      v_primary_location_id
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

*/
