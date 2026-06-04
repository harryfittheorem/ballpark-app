-- =============================================================================
-- Fix: families + kids RLS for admin / owner / super_admin mobile flows
-- =============================================================================
--
-- Problem 1 — families inner join blocks kids list for admin
--   Phase 2 migration replaced the broad families_select_admin policy with
--   families_admin_select_staff_locations, which limits rows to those whose
--   primary_location_id is in the admin's staff_locations rows. A freshly-
--   provisioned admin (zero staff_locations rows) therefore gets 0 family rows,
--   and the `kids JOIN families!inner(...)` in listTenantKids() returns 0 kids.
--
--   Fix: add a stacking policy (OR logic in Postgres RLS) that lets admin,
--   owner, and super_admin see ALL families in their own tenant_id. This does
--   NOT replace families_admin_select_staff_locations, so portal queries that
--   want location-scoped results are unaffected.
--
-- Problem 2 — kids_owner_select and kids_select_super_admin use a raw subquery
--   on public.families that is evaluated under the caller's RLS context.
--   Owner's families_owner_select and super_admin's families_select_super_admin
--   work fine, but the INNER expression `SELECT id FROM public.families WHERE
--   tenant_id = ...` inside the kids policy runs as the caller, so it can only
--   see families the caller's families policies permit. The existing SECURITY
--   DEFINER helper _get_caller_tenant_family_ids() (created in 20260613000000)
--   bypasses this by running as the function owner. Use it for owner and
--   super_admin kids policies too, mirroring the admin fix.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Broad tenant-scoped families SELECT for staff roles (mobile join path)
-- ---------------------------------------------------------------------------
-- Stacks with families_admin_select_staff_locations (portal location-scoping).
-- Postgres evaluates RLS policies with OR logic within a command type.

DROP POLICY IF EXISTS families_staff_role_tenant_select ON public.families;

CREATE POLICY families_staff_role_tenant_select ON public.families
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('admin', 'owner', 'super_admin')
  );


-- ---------------------------------------------------------------------------
-- 2. Fix kids_owner_select — use SECURITY DEFINER helper
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS kids_owner_select ON public.kids;

CREATE POLICY kids_owner_select ON public.kids
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND family_id IN (
      SELECT public._get_caller_tenant_family_ids()
    )
  );


-- ---------------------------------------------------------------------------
-- 3. Fix kids_select_super_admin — use SECURITY DEFINER helper
-- ---------------------------------------------------------------------------
-- Drops the existing policy (created in 20260612000000) and recreates it
-- using the helper so the family subquery is not subject to the caller's
-- families RLS policies.

DROP POLICY IF EXISTS kids_select_super_admin ON public.kids;

CREATE POLICY kids_select_super_admin ON public.kids
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'super_admin'
    AND family_id IN (
      SELECT public._get_caller_tenant_family_ids()
    )
  );


-- =============================================================================
-- VALIDATION (run in Supabase SQL editor with SET LOCAL jwt claims)
--
-- 1. Admin with zero staff_locations sees all kids:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<admin_uid>","app_role":"admin","tenant_id":"<tid>"}';
--    SELECT count(*) FROM public.kids;   -- must be > 0
--
-- 2. Owner sees all kids in tenant:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<owner_uid>","app_role":"owner","tenant_id":"<tid>"}';
--    SELECT count(*) FROM public.kids;   -- must be > 0
--
-- 3. Parent still sees only their own kids (no regression):
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<parent_uid>","app_role":"parent","tenant_id":"<tid>"}';
--    SELECT count(*) FROM public.kids;   -- must equal that family's kid count
-- =============================================================================
