-- Fix custom_access_token_hook to inject tenant_id + app_role for owners/admins.
--
-- Previously the hook only handled parents (via families) and coaches (via coaches),
-- so owner/admin JWTs were issued with no tenant_id or app_role claim. This caused:
--   • Portal member list to show demo data (readTenantId returned null → 0 rows)
--   • stripe_subscription_id never saved (DB update matched 0 rows on tenant_id='')
--   • Pause/resume edge functions to return 403 for portal owners
--
-- Changes:
--   1. Add third lookup branch for owners/admins via raw_user_meta_data tenant_slug
--      → tenants.slug lookup → injects tenant_id + app_role
--   2. Also inject 'app_role' for parents and coaches (was only 'role' before);
--      keeps 'role' for backward-compat with any code that reads it.

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
  v_role      text;
  v_app_role  text;
  v_slug      text;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

  -- ── 1. Parent / family ──────────────────────────────────────────────────
  SELECT tenant_id, id, role
    INTO v_tenant_id, v_family_id, v_role
    FROM public.families
   WHERE parent_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id', v_tenant_id,
           'family_id', v_family_id,
           'app_role',  'parent',
           'role',      v_role
         );

  ELSE
    -- ── 2. Coach ───────────────────────────────────────────────────────────
    SELECT tenant_id INTO v_tenant_id
      FROM public.coaches
     WHERE user_id = v_user_id AND is_active = true;

    IF v_tenant_id IS NOT NULL THEN
      v_claims := v_claims
        || jsonb_build_object(
             'tenant_id', v_tenant_id,
             'app_role',  'coach',
             'role',      'coach'
           );

    ELSE
      -- ── 3. Owner / admin (role stored in raw_user_meta_data) ────────────
      -- Owners are not in families or coaches; their tenant is identified by
      -- raw_user_meta_data->>'tenant_slug' which maps to public.tenants.slug.
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
                 'app_role',  v_app_role,
                 'role',      v_app_role
               );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- Permissions are unchanged — hook runs as postgres, callable only by supabase_auth_admin.
ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
