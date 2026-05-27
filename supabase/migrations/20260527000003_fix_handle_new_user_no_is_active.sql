-- =============================================================================
-- Fix handle_new_user: remove is_active filter from location validation.
-- =============================================================================
-- The locations table does not have an is_active column in the live database,
-- so the trigger was crashing with "unexpected_failure" whenever a location_id
-- was passed in signup metadata (i.e. whenever the location picker was used).
-- Remove the is_active predicate from both the validation query and the
-- fallback query. Location availability is managed at the app layer.
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
  -- Location resolution.
  -- Step 1: Parse location_id from signup metadata (invalid UUID → NULL).
  -- Step 2: Validate it belongs to this tenant (cross-tenant UUIDs rejected).
  -- Step 3: Fall back to alphabetically-first location if none resolved.
  -- NOTE: No is_active filter — that column does not exist on locations.
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
       AND tenant_id = v_tenant_id;
  END IF;

  IF v_primary_location_id IS NULL THEN
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
    NULL;

  ELSE
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
