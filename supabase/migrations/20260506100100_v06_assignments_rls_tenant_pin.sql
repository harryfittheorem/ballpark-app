-- =============================================================================
-- Ballpark — v0.6 Assignments RLS fixup: tenant pin on joined families
-- =============================================================================
-- Two SELECT policies created in 20260506100000_v06_assignments_schema.sql
-- pinned the *outer* row's tenant_id to the JWT tenant but did NOT pin the
-- joined `families` row's tenant_id. Even though every INSERT on
-- assignments / coach_messages enforces the kid+family tenant pin via
-- WITH CHECK, defense in depth says the SELECT side should also re-assert
-- it so a bad row inserted out-of-band (e.g. a future direct-SQL admin
-- task) can't be smuggled across tenants by a parent who happens to own
-- a row in another tenant.
--
-- Same shape of fix as 20260505051000_harden_bookings_fk_tenant_pin.sql.
-- =============================================================================

DROP POLICY IF EXISTS assignments_select_own_family ON public.assignments;
CREATE POLICY assignments_select_own_family ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM public.families f
       WHERE f.id = assignments.family_id
         AND f.parent_user_id = auth.uid()
         AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

DROP POLICY IF EXISTS videos_select_assignment_parent ON public.videos;
CREATE POLICY videos_select_assignment_parent ON public.videos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.assignments a
        JOIN public.families f ON f.id = a.family_id
       WHERE a.drill_video_id = videos.id
         AND a.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
         AND f.parent_user_id = auth.uid()
         AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
