-- =============================================================================
-- Ballpark — Phase 2, Step 5: Inject primary_location_id into JWT
-- =============================================================================
-- Updates custom_access_token_hook to include `primary_location_id` in the
-- JWT claims for parent and coach roles.
--
-- Staleness note: existing sessions will not receive the new claim until
-- their token is refreshed (up to 1 hour). Communicate this to the team
-- before deploying. Users can force-refresh by signing out and back in.
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
  v_is_sa              boolean;
  v_primary_loc_id     uuid;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

  -- 1. Super-admin check first (no tenant_id or location injected).
  SELECT EXISTS(SELECT 1 FROM public.super_admins WHERE user_id = v_user_id)
    INTO v_is_sa;

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
  --    No primary_location_id injected — owners/admins use staff_locations.
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


-- =============================================================================
-- VALIDATION QUERIES
-- =============================================================================
-- After a parent signs out and back in, run scripts/check-jwt.mjs to
-- confirm the JWT payload now includes `primary_location_id`.
--
-- Manual check via psql:
--   SELECT public.custom_access_token_hook(
--     jsonb_build_object(
--       'user_id', '<parent_user_id>',
--       'claims', '{}'::jsonb
--     )
--   ) -> 'claims' ->> 'primary_location_id';
-- Expected: the UUID of the family's primary location.
-- =============================================================================
