-- =============================================================================
-- Ballpark — Task #190: HQ Super-Admin & Franchise Management Console
-- =============================================================================
-- 1. super_admins table
-- 2. locations.is_active column
-- 3. Updated custom_access_token_hook (super_admin check first)
-- 4. Updated handle_new_user (skip tenant resolution for super_admin)
-- 5. RLS policies: super_admin bypass on key tables
-- 6. Public SELECT policy on active locations (mobile location picker)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. super_admins table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.super_admins (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  email      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins can see each other; no client-side INSERT/UPDATE/DELETE.
CREATE POLICY super_admins_select ON public.super_admins
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');

GRANT SELECT ON public.super_admins TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.super_admins TO supabase_auth_admin;


-- -----------------------------------------------------------------------------
-- 2. locations.is_active column
-- -----------------------------------------------------------------------------
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;


-- -----------------------------------------------------------------------------
-- 3. Updated custom_access_token_hook
--    Priority order: super_admin → parent/family → coach → owner/admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_claims    jsonb;
  v_tenant_id uuid;
  v_family_id uuid;
  v_app_role  text;
  v_is_sa     boolean;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

  -- 1. Super-admin check first (no tenant_id injected).
  SELECT EXISTS(SELECT 1 FROM public.super_admins WHERE user_id = v_user_id)
    INTO v_is_sa;

  IF v_is_sa THEN
    v_claims := v_claims || jsonb_build_object('app_role', 'super_admin');
    RETURN jsonb_set(event, '{claims}', v_claims);
  END IF;

  -- 2. Try parent / family.
  SELECT tenant_id, id, role
    INTO v_tenant_id, v_family_id, v_app_role
    FROM public.families
   WHERE parent_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id', v_tenant_id,
           'family_id', v_family_id,
           'app_role',  'parent'
         );
    RETURN jsonb_set(event, '{claims}', v_claims);
  END IF;

  -- 3. Try coach.
  SELECT tenant_id INTO v_tenant_id
    FROM public.coaches
   WHERE user_id = v_user_id AND is_active = true;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id', v_tenant_id,
           'app_role',  'coach'
         );
    RETURN jsonb_set(event, '{claims}', v_claims);
  END IF;

  -- 4. Fallback: owner / admin from raw_user_meta_data (portal-only roles).
  v_app_role := (
    SELECT raw_user_meta_data->>'app_role'
      FROM auth.users
     WHERE id = v_user_id
  );
  IF v_app_role IN ('owner', 'admin') THEN
    SELECT id INTO v_tenant_id
      FROM public.tenants
     WHERE slug = (
       SELECT raw_user_meta_data->>'tenant_slug'
         FROM auth.users
        WHERE id = v_user_id
     );
    IF v_tenant_id IS NOT NULL THEN
      v_claims := v_claims
        || jsonb_build_object(
             'tenant_id', v_tenant_id,
             'app_role',  v_app_role
           );
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;


-- -----------------------------------------------------------------------------
-- 4. Updated handle_new_user — skip for super_admin (no tenant_slug needed)
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- 5. RLS policies: super_admin cross-tenant bypass
--    Super admins can SELECT across all tenants on key tables.
-- -----------------------------------------------------------------------------

-- tenants
CREATE POLICY tenants_select_super_admin ON public.tenants
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');

CREATE POLICY tenants_insert_super_admin ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');

CREATE POLICY tenants_update_super_admin ON public.tenants
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');

-- locations
CREATE POLICY locations_select_super_admin ON public.locations
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');

CREATE POLICY locations_insert_super_admin ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');

CREATE POLICY locations_update_super_admin ON public.locations
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');

-- families
CREATE POLICY families_select_super_admin ON public.families
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');

-- coaches
CREATE POLICY coaches_select_super_admin ON public.coaches
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');

-- memberships (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='memberships') THEN
    EXECUTE $p$
      CREATE POLICY memberships_select_super_admin ON public.memberships
        FOR SELECT TO authenticated
        USING ((auth.jwt() ->> 'app_role') = 'super_admin')
    $p$;
  END IF;
END $$;

-- payment_events (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_events') THEN
    EXECUTE $p$
      CREATE POLICY payment_events_select_super_admin ON public.payment_events
        FOR SELECT TO authenticated
        USING ((auth.jwt() ->> 'app_role') = 'super_admin')
    $p$;
  END IF;
END $$;

-- Grant SELECT on super_admins to authenticated (for self-read after login).
GRANT SELECT ON public.super_admins TO authenticated;
GRANT SELECT ON public.locations TO anon;


-- -----------------------------------------------------------------------------
-- 6. Public SELECT on active locations + tenant name/slug (mobile location picker)
--    Anon users can list active locations and their tenant info at signup.
-- -----------------------------------------------------------------------------
CREATE POLICY locations_select_active_public ON public.locations
  FOR SELECT TO anon
  USING (is_active = true);

-- Expose minimal tenant info (name, slug) to anon for the location picker join.
-- This is non-sensitive information required for multi-tenant signup UX.
CREATE POLICY tenants_select_public ON public.tenants
  FOR SELECT TO anon
  USING (true);

GRANT SELECT (id, name, slug) ON public.tenants TO anon;
