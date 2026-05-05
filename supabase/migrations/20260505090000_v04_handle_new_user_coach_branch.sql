-- =============================================================================
-- Ballpark — v0.4 Step 4.2: handle_new_user coach branch
-- =============================================================================
-- Adds an `app_role` branch to the auth.users INSERT trigger so admin-
-- provisioned coaches land in `public.coaches` instead of (silently and
-- incorrectly) producing a stray families row.
--
-- Routing:
--   raw_user_meta_data->>'app_role' = 'coach'  -> INSERT public.coaches
--   anything else (NULL, 'parent', typo, ...)  -> INSERT public.families
--                                                 (existing v0.1/v0.3 behavior,
--                                                  byte-for-byte preserved)
--
-- Tenant resolution from `tenant_slug` and the loud-fail behavior on missing
-- or unknown tenant are SHARED by both branches and run before the branch
-- decision — same contract as v0.1/v0.3.
--
-- Coach-branch specifics (Open Decisions A/B/C in the plan):
--
--   A. Plain INSERT — no UPSERT against the seeded ghost Coach Mike row
--      (`...0201`, NULL user_id) from 20260505060000. The phone-test
--      verification provisions `coach.mike@infinitehitting.com` via the
--      Supabase dashboard; before doing so, the operator must DELETE the
--      seeded ghost row in the dashboard so we don't end up with two Coach
--      Mikes (one orphaned ghost still owning coach_availability seeds).
--      We accept this dev-only manual step in exchange for trigger
--      simplicity. coaches.user_id is UNIQUE so a same-user INSERT would
--      hard-fail loudly anyway.
--
--   B. RAISE EXCEPTION when `first_name` or `last_name` is blank/missing
--      on the coach branch. coaches.first_name/last_name are NOT NULL,
--      and unlike the parent path there's no follow-up screen (AddKid)
--      that fills in identity later — so a blank coach name is an
--      admin-error we want to surface immediately at provisioning time.
--      Parent path keeps its COALESCE-to-'' tolerance unchanged.
--
--   C. coaches.primary_location_id defaults to NULL (column is nullable).
--      Coach <-> location assignment is an admin/dashboard concern and
--      should not be auto-decided by alphabetical location order the way
--      the families default does (per Step 3.11). Different tables,
--      different defaults.
--
-- The custom_access_token_hook from 20260505040800 is intentionally
-- untouched — its existing parent-first / coach-fallback ordering already
-- produces app_role='coach' + tenant_id (and no family_id) for any auth
-- user that has a row in public.coaches with is_active=true.
--
-- CREATE OR REPLACE preserves the function OID, so the EXECUTE revokes
-- from 20260505015720_revoke_handle_new_user_execute.sql remain in
-- effect. We re-revoke at the bottom defensively, matching the pattern
-- used by 20260505070000.
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
  v_primary_location_id uuid;
BEGIN
  -- Shared tenant resolution (loud-fail for both branches; preserves the
  -- v0.1 contract that every new auth.users row MUST carry tenant_slug).
  v_tenant_slug := NEW.raw_user_meta_data->>'tenant_slug';
  IF v_tenant_slug IS NULL OR v_tenant_slug = '' THEN
    RAISE EXCEPTION 'handle_new_user: tenant_slug missing from raw_user_meta_data';
  END IF;

  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: unknown tenant_slug %', v_tenant_slug;
  END IF;

  v_app_role := NEW.raw_user_meta_data->>'app_role';

  IF v_app_role = 'coach' THEN
    -- Coach branch (Decision B): require first_name + last_name in metadata.
    v_first_name := NEW.raw_user_meta_data->>'first_name';
    v_last_name  := NEW.raw_user_meta_data->>'last_name';
    IF v_first_name IS NULL OR v_first_name = ''
       OR v_last_name  IS NULL OR v_last_name  = '' THEN
      RAISE EXCEPTION
        'handle_new_user: app_role=coach requires first_name and last_name in raw_user_meta_data';
    END IF;

    -- Decision C: primary_location_id stays NULL; admin sets via dashboard.
    INSERT INTO public.coaches (
      tenant_id,
      user_id,
      first_name,
      last_name,
      is_active
    ) VALUES (
      v_tenant_id,
      NEW.id,
      v_first_name,
      v_last_name,
      true
    );

  ELSE
    -- Parent branch (default). Strict superset of 20260505070000:
    -- preserves the Step 3.11 primary_location_id default.
    SELECT id
      INTO v_primary_location_id
      FROM public.locations
     WHERE tenant_id = v_tenant_id
     ORDER BY name ASC
     LIMIT 1;

    INSERT INTO public.families (
      tenant_id,
      parent_user_id,
      parent_first_name,
      parent_last_name,
      parent_phone,
      parent_email,
      primary_location_id
    ) VALUES (
      v_tenant_id,
      NEW.id,
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

-- Re-assert the hardened EXECUTE grants from
-- 20260505015720_revoke_handle_new_user_execute.sql. CREATE OR REPLACE
-- preserves grants in PostgreSQL, so this is defensive only (matches
-- the pattern used by 20260505070000).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
