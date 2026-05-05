-- =============================================================================
-- Harden bookings write policies — pin coach_id / location_id / session_type_id
-- to the caller's tenant
-- =============================================================================
-- Code-review finding (Task #33): the original bookings_insert_own_family and
-- bookings_update_own_family policies only verified tenant_id + kid_id
-- ownership. They did NOT verify that coach_id, location_id, or
-- session_type_id belonged to the same tenant. A parent could therefore
-- insert (or rewrite) a booking with their own tenant_id while referencing
-- another tenant's coach / location / session_type FK, creating cross-tenant
-- linkage and breaking the tenant-isolation guarantee promised everywhere
-- else in the schema.
--
-- Fix: extend WITH CHECK (and UPDATE.USING) on the two write policies with
-- EXISTS clauses that verify each referenced FK row's tenant_id matches the
-- JWT tenant_id. Same pattern as the families/coaches UPDATE hardening from
-- 20260505015552_harden_update_policies_tenant_pin.sql, applied to outbound
-- FKs instead of the row's own column.
-- =============================================================================

DROP POLICY IF EXISTS bookings_insert_own_family ON public.bookings;
CREATE POLICY bookings_insert_own_family ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.id = bookings.coach_id
        AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = bookings.location_id
        AND l.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM public.session_types st
      WHERE st.id = bookings.session_type_id
        AND st.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

DROP POLICY IF EXISTS bookings_update_own_family ON public.bookings;
CREATE POLICY bookings_update_own_family ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.id = bookings.coach_id
        AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = bookings.location_id
        AND l.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM public.session_types st
      WHERE st.id = bookings.session_type_id
        AND st.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
