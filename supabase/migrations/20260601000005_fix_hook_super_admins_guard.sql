-- =============================================================================
-- Ballpark — Hotfix: guard super_admins table check in custom_access_token_hook
-- =============================================================================
-- Phase 2 migration 20260601000004 added a SELECT from public.super_admins
-- before checking whether the table exists, crashing the hook with
-- "relation public.super_admins does not exist" and returning 500 to GoTrue.
-- Supabase surfaces hook 500s as "Email or password is incorrect", blocking
-- every login for every role.
--
-- Fix: check pg_tables first; only query super_admins if the table is present.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id            uuid;
  v_claims             jsonb;
  v_tenant_id          uuid;
  v_family_id          uuid;
  v_app_role           text;
  v_is_sa              boolean := false;
  v_primary_loc_id     uuid;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

  -- 1. Super-admin check — only if the table exists (graceful degradation).
  IF EXISTS (
    SELECT 1 FROM pg_tables
     WHERE schemaname = 'public' AND tablename = 'super_admins'
  ) THEN
    SELECT EXISTS(SELECT 1 FROM public.super_admins WHERE user_id = v_user_id)
      INTO v_is_sa;
  END IF;

  IF v_is_sa THEN
    v_claims := v_claims || jsonb_build_object('app_role', 'super_admin');
    RETURN jsonb_set(event, '{claims}', v_claims);
  END IF;

  -- 2. Try parent / family.
  SELECT f.tenant_id, f.id, f.primary_location_id
    INTO v_tenant_id, v_family_id, v_primary_loc_id
    FROM public.families f
   WHERE f.parent_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id',           v_tenant_id,
           'family_id',           v_family_id,
           'app_role',            'parent',
           'primary_location_id', v_primary_loc_id
         );
    RETURN jsonb_set(event, '{claims}', v_claims);
  END IF;

  -- 3. Try coach.
  SELECT c.tenant_id, c.primary_location_id
    INTO v_tenant_id, v_primary_loc_id
    FROM public.coaches c
   WHERE c.user_id = v_user_id AND c.is_active = true;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id',           v_tenant_id,
           'app_role',            'coach',
           'primary_location_id', v_primary_loc_id
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
