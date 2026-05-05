-- =============================================================================
-- Harden UPDATE policies — pin tenant_id to JWT tenant
-- =============================================================================
-- Code-review finding: the original families_update_own and coaches_update_own
-- policies only constrained parent_user_id / user_id in WITH CHECK. They did
-- NOT prevent the authenticated user from rewriting their own row's tenant_id
-- to another valid tenant UUID. Because custom_access_token_hook derives the
-- JWT `tenant_id` claim from these tables on next token issuance, that would
-- let a user hop tenants and gain cross-tenant read scope via every other RLS
-- policy in the schema.
--
-- Fix: require tenant_id = JWT tenant in both USING and WITH CHECK on the
-- two UPDATE policies. This both blocks the row being moved out of the
-- caller's tenant AND blocks it being moved into a different one.
-- =============================================================================

DROP POLICY IF EXISTS families_update_own ON public.families;
CREATE POLICY families_update_own ON public.families
  FOR UPDATE TO authenticated
  USING (
    parent_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    parent_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

DROP POLICY IF EXISTS coaches_update_own ON public.coaches;
CREATE POLICY coaches_update_own ON public.coaches
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
