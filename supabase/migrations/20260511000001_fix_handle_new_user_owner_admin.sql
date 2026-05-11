-- =============================================================================
-- Fix handle_new_user: skip families INSERT for owner / admin roles
-- =============================================================================
-- Previously the ELSE branch of handle_new_user inserted every non-coach
-- user into public.families as a parent. Owner and admin accounts created
-- via the admin API (app_role='owner'/'admin' in raw_user_meta_data) were
-- silently inserted as parent family rows. The custom_access_token_hook
-- then found those rows first and returned app_role='parent', causing the
-- portal to sign them out immediately on login.
--
-- Fix: add an ELSIF guard for 'owner' and 'admin' that just returns NEW
-- without touching any table. These roles are portal-only; they live only
-- in auth.users and are resolved by the hook's third fallback branch.
--
-- Also: delete the spurious family row for the existing owner account.
-- =============================================================================

-- 1. Remove the spurious family row created for the owner account.
DELETE FROM public.families
 WHERE parent_user_id = '75dfb0d3-1c53-49b8-a7b2-813ea33aab76';

-- 2. Update the trigger so future owner/admin accounts are never inserted
--    into public.families.
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
    v_first_name := NEW.raw_user_meta_data->>'first_name';
    v_last_name  := NEW.raw_user_meta_data->>'last_name';
    IF v_first_name IS NULL OR v_first_name = ''
       OR v_last_name  IS NULL OR v_last_name  = '' THEN
      RAISE EXCEPTION
        'handle_new_user: app_role=coach requires first_name and last_name in raw_user_meta_data';
    END IF;

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

  ELSIF v_app_role IN ('owner', 'admin') THEN
    -- Portal-only roles: no row needed in families or coaches.
    -- The custom_access_token_hook resolves them from raw_user_meta_data.
    NULL;

  ELSE
    -- Default: parent / family.
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
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
