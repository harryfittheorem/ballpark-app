-- =============================================================================
-- Fix custom_access_token_hook to handle owner (and admin) roles
-- =============================================================================
-- Previously the hook only injected app_role for users found in
-- public.families (parents) or public.coaches. Owner/admin users exist
-- only in auth.users with raw_user_meta_data.app_role set, so the hook
-- fell through without setting any claim — readAppRole() returned "parent"
-- and the portal signed them out immediately on login.
--
-- Fix: add a third fallback branch that reads raw_user_meta_data from
-- auth.users (accessible from SECURITY DEFINER as postgres) and injects
-- app_role + tenant_id for 'owner' and 'admin' roles.
-- =============================================================================

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
  v_meta_role text;
  v_meta_slug text;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

  -- 1. Parent / family path.
  SELECT tenant_id, id, role
    INTO v_tenant_id, v_family_id, v_app_role
    FROM public.families
   WHERE parent_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id', v_tenant_id,
           'family_id', v_family_id,
           'app_role',  v_app_role
         );

  ELSE
    -- 2. Coach path.
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
      -- 3. Owner / admin path — read raw_user_meta_data directly from
      --    auth.users (only accessible inside a SECURITY DEFINER fn).
      SELECT
        (raw_user_meta_data->>'app_role'),
        (raw_user_meta_data->>'tenant_slug')
        INTO v_meta_role, v_meta_slug
        FROM auth.users
       WHERE id = v_user_id;

      IF v_meta_role IN ('owner', 'admin') THEN
        SELECT id INTO v_tenant_id
          FROM public.tenants
         WHERE slug = v_meta_slug;

        v_claims := v_claims
          || jsonb_build_object(
               'tenant_id', v_tenant_id,
               'app_role',  v_meta_role
             );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
