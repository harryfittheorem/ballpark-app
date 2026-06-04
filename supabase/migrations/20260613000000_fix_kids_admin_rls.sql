-- Fix kids_select_admin: resolve family IDs without applying the caller's
-- families RLS (which restricts admins to staff_locations-scoped families).
--
-- The Phase 2 migration introduced families_admin_select_staff_locations,
-- which limits SELECT on public.families to rows whose primary_location_id
-- is in public.staff_locations for the calling user. A freshly-provisioned
-- admin with no staff_locations rows therefore sees an empty families
-- subquery inside kids_select_admin, making the full kid list invisible on
-- the drill-assign screen.
--
-- Fix: replace the inline subquery with a SECURITY DEFINER helper that runs
-- as the function owner (bypassing the caller's families RLS) and returns
-- only the family IDs that belong to the CALLER'S OWN tenant (derived from
-- auth.jwt() inside the function — never from a caller-supplied parameter,
-- so cross-tenant enumeration is impossible even via direct SQL/RPC calls).
-- The policy still pins app_role='admin' and tenant_id from the JWT — only
-- the family-id resolution is lifted out of the caller's RLS context.

-- 1. Drop the old parameterized version if it exists (initial deploy attempt
--    may have left it; idempotent DROP guards against "does not exist" error).

DROP FUNCTION IF EXISTS public._get_tenant_family_ids(uuid);

-- 2. Helper function (no parameter — tenant derived from JWT internally) ------

CREATE OR REPLACE FUNCTION public._get_caller_tenant_family_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
    FROM public.families
   WHERE tenant_id = NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

REVOKE ALL ON FUNCTION public._get_caller_tenant_family_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._get_caller_tenant_family_ids() TO authenticated;

-- 3. Recreate kids_select_admin using the helper ------------------------------

DROP POLICY IF EXISTS kids_select_admin ON public.kids;

CREATE POLICY kids_select_admin ON public.kids
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND family_id IN (
      SELECT public._get_caller_tenant_family_ids()
    )
  );
