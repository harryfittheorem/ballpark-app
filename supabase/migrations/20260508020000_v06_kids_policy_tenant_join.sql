-- =============================================================================
-- v0.6 — Defense-in-depth: pin kids RLS policies to the JWT tenant via the
--        families subquery (task #86).
-- =============================================================================
-- Background
-- ----------
-- The original kids_insert_own_family / kids_update_own_family policies (see
-- 20260505014743_initial_schema.sql §8) only check that the target family_id
-- belongs to a family owned by auth.uid(). That's correct in practice today
-- because public.families itself is tenant-scoped via its own RLS — a parent
-- only sees their own family row, so the IN (SELECT id FROM families WHERE
-- parent_user_id = auth.uid()) sub-select effectively returns at most one
-- row, and that row belongs to the parent's tenant.
--
-- But there is no defence-in-depth. If a future migration:
--   * weakens families RLS,
--   * adds a SECURITY DEFINER helper that returns family ids without
--     re-checking tenant_id, or
--   * a service-role code path forgets to set tenant context,
-- the kids policies would silently allow a kids row to be created or moved
-- under any family the caller can see, including across the tenant boundary.
--
-- Schema note: public.kids does NOT have a tenant_id column of its own. The
-- tenant is resolved via kids.family_id -> families.id -> families.tenant_id.
-- So the hardening must push the JWT-tenant check INTO the families
-- sub-select, not reference a non-existent kids.tenant_id column.
--
-- This migration drops and recreates kids_insert_own_family and
-- kids_update_own_family with the families-join hardening shape:
--
--   family_id IN (
--     SELECT f.id
--       FROM public.families f
--      WHERE f.parent_user_id = auth.uid()
--        AND f.tenant_id      = ((auth.jwt() ->> 'tenant_id')::uuid)
--   )
--
-- Legitimate parent flows (signup, kid registration, profile edit) keep
-- working unchanged — the parent's own JWT tenant_id always matches their
-- family's tenant_id, so the new clause is a true no-op for them.
--
-- kids_select_own_family and kids_delete_own_family are intentionally NOT
-- modified by this migration. SELECT and DELETE only operate on existing
-- rows the parent can already see, and the original USING clause (which
-- relies on the family they own) is sufficient for those verbs. Adding the
-- tenant pin there would only matter if families RLS itself were broken,
-- in which case we'd need a separate, cross-cutting migration. Out of scope
-- per the #86 plan.
--
-- The kids_select_coach_stub policy is also left as-is; it already pins
-- f.tenant_id = JWT tenant_id (see initial_schema.sql §8 and
-- rename_role_to_app_role_in_jwt.sql §6).
-- =============================================================================


-- INSERT --------------------------------------------------------------------
DROP POLICY IF EXISTS kids_insert_own_family ON public.kids;
CREATE POLICY kids_insert_own_family ON public.kids
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT f.id
        FROM public.families f
       WHERE f.parent_user_id = auth.uid()
         AND f.tenant_id      = ((auth.jwt() ->> 'tenant_id')::uuid)
    )
  );

COMMENT ON POLICY kids_insert_own_family ON public.kids IS
$c$Defence-in-depth tenant pin (task #86, 2026-05-08). The
families sub-select pins f.tenant_id to the caller's JWT tenant
in addition to the original parent_user_id ownership check, so a
kids row literally cannot be inserted under a family belonging to
a different tenant — even if some other code path were to leak a
stale family_id. public.kids has no direct tenant_id column;
tenant linkage is via kids.family_id -> families.tenant_id, which
is why the pin lives inside the sub-select. Do not simplify back
to the families-only ownership check.$c$;


-- UPDATE --------------------------------------------------------------------
DROP POLICY IF EXISTS kids_update_own_family ON public.kids;
CREATE POLICY kids_update_own_family ON public.kids
  FOR UPDATE TO authenticated
  USING (
    family_id IN (
      SELECT f.id
        FROM public.families f
       WHERE f.parent_user_id = auth.uid()
         AND f.tenant_id      = ((auth.jwt() ->> 'tenant_id')::uuid)
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT f.id
        FROM public.families f
       WHERE f.parent_user_id = auth.uid()
         AND f.tenant_id      = ((auth.jwt() ->> 'tenant_id')::uuid)
    )
  );

COMMENT ON POLICY kids_update_own_family ON public.kids IS
$c$Defence-in-depth tenant pin (task #86, 2026-05-08). Same
shape as kids_insert_own_family but applied to both USING (the
row visible for update) and WITH CHECK (the new family_id after
update). Together these prevent both a cross-tenant UPDATE that
targets a foreign kid AND a same-tenant UPDATE that tries to
re-parent the row across the boundary.$c$;
