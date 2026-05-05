-- =============================================================================
-- Rename application-level `role` JWT claim to `app_role`
-- =============================================================================
-- Bug: custom_access_token_hook was overwriting the JWT's reserved `role`
-- claim with the application value ('parent' / 'coach'). PostgREST consumes
-- `role` as the Postgres role to SET ROLE into for the request. GoTrue
-- normally injects role='authenticated' so PostgREST switches into the
-- `authenticated` Postgres role. Once we overwrote it with 'parent', PostgREST
-- tried `SET ROLE 'parent'`, which doesn't exist as a Postgres role, and
-- returned 401 with `code: 22023, message: role "parent" does not exist` on
-- EVERY authenticated request — breaking the family lookup, the kid insert,
-- and effectively every RLS-protected query in the app.
--
-- Fix: write the application-level role to a non-reserved claim name
-- (`app_role`) and leave the reserved `role` claim untouched so GoTrue's
-- 'authenticated' value flows through to PostgREST. Update the two RLS
-- policies that read the role claim accordingly.
--
-- Reserved JWT claim names PostgREST/GoTrue care about (do not overwrite):
--   role, aud, exp, iat, iss, sub
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
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := COALESCE(event->'claims', '{}'::jsonb);

  -- Try parent / family first.
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
    -- Fallback: coach.
    SELECT tenant_id INTO v_tenant_id
      FROM public.coaches
     WHERE user_id = v_user_id AND is_active = true;

    IF v_tenant_id IS NOT NULL THEN
      v_claims := v_claims
        || jsonb_build_object(
             'tenant_id', v_tenant_id,
             'app_role',  'coach'
           );
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Update RLS policies that referenced auth.jwt() ->> 'role' to use 'app_role'.
DROP POLICY IF EXISTS families_select_coach_stub ON public.families;
CREATE POLICY families_select_coach_stub ON public.families
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

DROP POLICY IF EXISTS kids_select_coach_stub ON public.kids;
CREATE POLICY kids_select_coach_stub ON public.kids
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'coach'
    AND family_id IN (
      SELECT id FROM public.families
       WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
