-- Fix custom_access_token_hook: add super_admin branch.
--
-- Migration 20260707120000 rewrote the hook to fix a PostgREST 'role' bug but
-- dropped the super_admin branch that existed in 20260514000003 and
-- 20260601000005. As a result, super_admin JWTs were issued with no app_role
-- claim, causing the HQ layout to redirect every bootstrap/invite user to
-- /logout?reason=parent immediately after sign-in.
--
-- Fix: check public.super_admins FIRST (before families / coaches / owner).
-- If the user_id is in that table → inject app_role = 'super_admin' and return.
-- All other branches are preserved verbatim from 20260707120000.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_claims    jsonb;
  v_is_sa     boolean;
  v_tenant_id uuid;
  v_family_id uuid;
  v_app_role  text;
  v_slug      text;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

  -- ── 0. Super admin ──────────────────────────────────────────────────────
  SELECT EXISTS(
    SELECT 1 FROM public.super_admins WHERE user_id = v_user_id
  ) INTO v_is_sa;

  IF v_is_sa THEN
    v_claims := v_claims || jsonb_build_object('app_role', 'super_admin');
    RETURN jsonb_set(event, '{claims}', v_claims);
  END IF;

  -- ── 1. Parent / family ──────────────────────────────────────────────────
  SELECT tenant_id, id, role
    INTO v_tenant_id, v_family_id, v_app_role
    FROM public.families
   WHERE parent_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id', v_tenant_id,
           'family_id', v_family_id,
           'app_role',  v_app_role   -- 'parent' — stored in families.role
         );

  ELSE
    -- ── 2. Coach ────────────────────────────────────────────────────────
    SELECT tenant_id INTO v_tenant_id
      FROM public.coaches
     WHERE user_id = v_user_id AND is_active = true;

    IF v_tenant_id IS NOT NULL THEN
      v_claims := v_claims
        || jsonb_build_object(
             'tenant_id', v_tenant_id,
             'app_role',  'coach'
           );

    ELSE
      -- ── 3. Owner / admin ──────────────────────────────────────────────
      SELECT
        raw_user_meta_data->>'app_role',
        raw_user_meta_data->>'tenant_slug'
      INTO v_app_role, v_slug
      FROM auth.users
      WHERE id = v_user_id
        AND raw_user_meta_data->>'app_role' IN ('owner', 'admin');

      IF v_slug IS NOT NULL THEN
        SELECT id INTO v_tenant_id
          FROM public.tenants
         WHERE slug = v_slug;

        IF v_tenant_id IS NOT NULL THEN
          v_claims := v_claims
            || jsonb_build_object(
                 'tenant_id', v_tenant_id,
                 'app_role',  v_app_role
               );
        END IF;
      END IF;
    END IF;
  END IF;

  -- NOTE: 'role' claim is intentionally NOT set here.
  -- GoTrue injects role='authenticated' and PostgREST needs that exact value
  -- to SET ROLE authenticated for RLS evaluation.
  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
