-- =============================================================================
-- Rollback: Phase 2 Step 4 — admin RLS scoped to staff_locations
-- =============================================================================
-- Run this block to faithfully restore the policy state that existed
-- immediately before 20260601000003_phase2_admin_rls_staff_locations.sql
-- was applied.
--
-- IMPORTANT: Keep on standby for 48 hours after production deploy.
--
-- Policy state BEFORE Step 4 (exact definitions from migration history):
--
--   bookings:    no admin policy. bookings_admin_select_staff_locations is NEW.
--   families:    families_select_admin — admin tenant-wide (from 20260511000000)
--   coaches:     coaches_select_active_in_tenant — ALL authenticated in tenant
--   locations:   locations_select_tenant — ALL authenticated in tenant
--                locations_owner_select  — owner AND admin (from stripe_connect)
-- =============================================================================


-- -------------------------------------------------------------------------
-- bookings — drop new admin policy (no prior policy to restore)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS bookings_admin_select_staff_locations ON public.bookings;


-- -------------------------------------------------------------------------
-- families — restore broad admin policy, drop scoped version
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS families_admin_select_staff_locations ON public.families;

CREATE POLICY families_select_admin ON public.families
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid
  );


-- -------------------------------------------------------------------------
-- coaches — restore broad coaches_select_active_in_tenant, drop scoped
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS coaches_admin_select_staff_locations ON public.coaches;

-- Restore the original broad policy (covers ALL authenticated roles).
DROP POLICY IF EXISTS coaches_select_active_in_tenant ON public.coaches;

CREATE POLICY coaches_select_active_in_tenant ON public.coaches
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND is_active = true
  );


-- -------------------------------------------------------------------------
-- locations — restore locations_select_tenant + owner+admin locations_owner_select
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS locations_admin_select_staff_locations ON public.locations;
DROP POLICY IF EXISTS locations_select_parent_coach ON public.locations;

-- Restore the original broad policy for all authenticated users.
DROP POLICY IF EXISTS locations_select_tenant ON public.locations;

CREATE POLICY locations_select_tenant ON public.locations
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Restore the owner+admin version of locations_owner_select
-- (as it was after 20260514000002_stripe_connect_locations.sql).
DROP POLICY IF EXISTS locations_owner_select ON public.locations;

CREATE POLICY locations_owner_select ON public.locations
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
  );


-- =============================================================================
-- VERIFICATION
-- After rollback, confirm:
--
-- 1. Admin sees ALL families in their tenant:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<admin_uid>","app_role":"admin","tenant_id":"<tid>"}';
--    SELECT COUNT(*) FROM public.families;
--    -- Should return all tenant families (not just one location).
--
-- 2. Parent and coach still see all active coaches:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<parent_uid>","app_role":"parent","tenant_id":"<tid>"}';
--    SELECT COUNT(*) FROM public.coaches;
--    -- Should return all active coaches.
-- =============================================================================
