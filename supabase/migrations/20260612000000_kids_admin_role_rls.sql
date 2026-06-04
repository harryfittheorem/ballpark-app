-- Fix admin role: add super_admin to kids SELECT policy.
--
-- The existing kids_select_admin policy (added in v0.7) covers app_role='admin'
-- but not app_role='super_admin'. Both roles map to the CoachTabNavigator on
-- mobile and should have the same tenant-scoped read access for drill
-- assignment and recipient picker flows.
--
-- The kids_select_admin policy is left untouched; we add a peer policy for
-- super_admin using the same family→tenant join pattern.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'kids'
      AND policyname = 'kids_select_super_admin'
  ) THEN
    CREATE POLICY kids_select_super_admin ON public.kids
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'app_role') = 'super_admin'
        AND family_id IN (
          SELECT id FROM public.families
           WHERE tenant_id = NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid
        )
      );
  END IF;
END $$;
