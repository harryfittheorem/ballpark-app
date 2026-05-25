-- =============================================================================
-- Fix memberships table permissions for mobile app (parent users).
--
-- Problem 1: No GRANT SELECT on memberships to authenticated role.
--            The error is explicit: "permission denied for table memberships
--            (hint: GRANT SELECT ON public.memberships TO authenticated)"
--
-- Problem 2: All existing parent SELECT policies check
--            (auth.jwt() ->> 'app_role') = 'parent'
--            In production the Custom Access Token Hook may not have run
--            for the current session, so app_role is absent from the JWT.
--            The policy never matches → permission denied even after the GRANT.
--
-- Fix: GRANT + rewrite parent policy to use auth.uid() directly (no JWT
--      claim required). Matching families.parent_user_id = auth.uid() is
--      the ground-truth ownership check — no role claim needed.
-- =============================================================================

-- Grant table-level SELECT so RLS policies can be evaluated at all.
GRANT SELECT ON public.memberships TO authenticated;

-- Remove stale parent policies that relied on the JWT app_role claim.
DROP POLICY IF EXISTS memberships_parent_self   ON public.memberships;
DROP POLICY IF EXISTS memberships_parent_select ON public.memberships;

-- Recreate without the JWT claim dependency.
-- A user can read memberships where they are the parent of the family.
CREATE POLICY memberships_parent_select ON public.memberships
  FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT id FROM public.families
       WHERE parent_user_id = auth.uid()
    )
  );
