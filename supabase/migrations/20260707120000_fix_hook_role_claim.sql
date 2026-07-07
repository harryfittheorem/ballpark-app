-- Fix custom_access_token_hook: remove 'role' overrides that break PostgREST.
--
-- Migration 20260707000000 re-introduced a bug that was already fixed in
-- 20260505040800: it set 'role' to 'parent'/'coach'/'owner' in the JWT.
-- PostgREST uses the JWT 'role' claim to SET ROLE in Postgres, so it must
-- stay as 'authenticated' (injected by GoTrue). Overwriting it causes:
--   401 {"code":"22023","message":"role \"parent\" does not exist"}
-- on every single authenticated REST call, making families/kids return empty.
--
-- Fix: only write to 'app_role', 'tenant_id', 'family_id' — never 'role'.

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
  v_slug      text;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

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
  -- to SET ROLE authenticated for RLS evaluation. Overwriting it with any
  -- application-level string (e.g. 'parent') causes 401 on every REST call.
  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
