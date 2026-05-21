-- =============================================================================
-- Ballpark — Phase 2, Step 4: Scope admin RLS to staff_locations
-- =============================================================================
-- HIGH RISK: This migration changes the row-level access policy for admin
-- users on four hot tables. Run full staging regression before applying to
-- production. Keep supabase/rollback/rollback_phase2_rls.sql on standby for
-- at least 48 hours post-deploy.
--
-- PREREQUISITE: scripts/backfill-staff-locations.mjs must have been run and
-- its count verified correct before this migration is applied.
--
-- WHAT EXISTS before this migration runs (policy audit):
--
--   bookings:
--     bookings_owner_select      — owner only (tenant-wide)   [20260511000002]
--     bookings_select_own_family — parent own bookings        [v03_bookings_schema]
--     bookings_insert_own_family — parent insert               [harden_bookings_fk]
--     bookings_update_own_family — parent update               [harden_bookings_fk]
--     bookings_delete_own_family — parent delete               [v03_bookings_schema]
--     bookings_select_coach      — coach tenant-wide SELECT    [v03_bookings_schema]
--     (no admin policy currently — admins can't see bookings)
--
--   families:
--     families_owner_select      — owner only (tenant-wide)   [20260511000002]
--     families_select_own        — parent own row             [initial_schema]
--     families_update_own        — parent own row             [harden_update]
--     families_select_coach_stub — coach tenant-wide SELECT   [rename_app_role]
--     families_select_admin      — admin tenant-wide SELECT   [20260511000000]
--     families_select_super_admin — super_admin bypass        [super_admin]
--
--   coaches:
--     coaches_select_active_in_tenant — ALL authenticated in tenant (parents, coaches, admins)
--     coaches_owner_select            — owner only (tenant-wide)  [20260511000002]
--     coaches_update_own              — coach updates own row      [harden_update]
--     coaches_select_super_admin      — super_admin bypass         [super_admin]
--
--   locations:
--     locations_select_tenant    — ALL authenticated in tenant    [initial_schema]
--     locations_owner_select     — owner AND admin tenant-wide    [stripe_connect_locations]
--     locations_select_super_admin — super_admin bypass           [super_admin]
--     locations_select_active_public — anon active locations      [super_admin]
--     locations_insert_super_admin — super_admin                  [super_admin]
--     locations_update_super_admin — super_admin                  [super_admin]
--     locations_owner_update_stripe — owner/admin update stripe   [stripe_connect_locations]
--     locations_service_all       — service_role bypass           [stripe_connect_locations]
--
-- WHAT THIS MIGRATION DOES:
--   bookings  — adds bookings_admin_select_staff_locations (new admin policy, no drop needed)
--   families  — replaces families_select_admin with staff_locations-scoped version
--   coaches   — narrows coaches_select_active_in_tenant to exclude admin role;
--               adds coaches_admin_select_staff_locations
--   locations — narrows locations_select_tenant to exclude admin role;
--               splits locations_owner_select into owner-only + admin staff_locations
-- =============================================================================


-- =============================================================================
-- bookings — add admin policy (no existing admin policy to remove)
-- =============================================================================

-- Admins see only bookings at their assigned location(s).
CREATE POLICY bookings_admin_select_staff_locations ON public.bookings
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND location_id IN (
      SELECT sl.location_id
        FROM public.staff_locations sl
       WHERE sl.user_id = auth.uid()
    )
  );


-- =============================================================================
-- families — replace broad admin policy with staff_locations-scoped version
-- =============================================================================

-- Drop the old tenant-wide admin policy (from 20260511000000_v07_achievements_and_fulfillment.sql).
DROP POLICY IF EXISTS families_select_admin ON public.families;

-- Admins see only families whose primary_location_id is in their assigned locations.
CREATE POLICY families_admin_select_staff_locations ON public.families
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND primary_location_id IN (
      SELECT sl.location_id
        FROM public.staff_locations sl
       WHERE sl.user_id = auth.uid()
    )
  );


-- =============================================================================
-- coaches — narrow broad policy to exclude admin, add admin staff_locations policy
-- =============================================================================

-- coaches_select_active_in_tenant applies to ALL authenticated users including
-- admin, which means admins can see every coach in the tenant. Narrow it to
-- only parent and coach roles; the owner policy below covers owners; admins
-- get a separate staff_locations-scoped policy.
DROP POLICY IF EXISTS coaches_select_active_in_tenant ON public.coaches;

CREATE POLICY coaches_select_active_in_tenant ON public.coaches
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND is_active = true
    AND (auth.jwt() ->> 'app_role') IN ('parent', 'coach')
  );

-- coaches_owner_select already exists with correct owner-only semantics.
-- Leave it untouched.

-- Admins see coaches who are assigned (via coach_locations) to at least one
-- of the admin's staff_locations. Scoping through the junction table means
-- a coach appears to an admin as long as any of their assigned locations
-- matches — regardless of which location is marked primary.
CREATE POLICY coaches_admin_select_staff_locations ON public.coaches
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND id IN (
      SELECT cl.coach_id
        FROM public.coach_locations cl
       WHERE cl.location_id IN (
         SELECT sl.location_id
           FROM public.staff_locations sl
          WHERE sl.user_id = auth.uid()
       )
    )
  );


-- =============================================================================
-- locations — narrow broad policies to exclude admin, add admin staff_locations
-- =============================================================================

-- locations_select_tenant applies to ALL authenticated users including admins.
-- Narrow it to parent and coach roles only.
DROP POLICY IF EXISTS locations_select_tenant ON public.locations;

CREATE POLICY locations_select_parent_coach ON public.locations
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('parent', 'coach')
  );

-- locations_owner_select currently covers owner AND admin (from stripe_connect_locations).
-- Split into owner-only + admin-specific.
DROP POLICY IF EXISTS locations_owner_select ON public.locations;

CREATE POLICY locations_owner_select ON public.locations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Admins see only their assigned locations.
-- tenant_id pin is mandatory: it prevents reading a foreign-tenant location
-- row even if a maliciously-crafted staff_locations row referenced it.
CREATE POLICY locations_admin_select_staff_locations ON public.locations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND id IN (
      SELECT sl.location_id
        FROM public.staff_locations sl
       WHERE sl.user_id = auth.uid()
    )
  );


-- =============================================================================
-- VALIDATION QUERIES (run after staging regression)
-- =============================================================================
-- Run these as specific JWT roles in the Supabase SQL editor or psql.
--
-- 1. Admin sees only their location's bookings (not others):
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<admin_uid>","app_role":"admin","tenant_id":"<tid>"}';
--    SELECT DISTINCT location_id FROM public.bookings;
--    -- Must only return location_ids in staff_locations for that admin.
--
-- 2. Admin sees only families at their location(s):
--    SELECT DISTINCT primary_location_id FROM public.families;
--    -- Must only return location_ids in staff_locations for that admin.
--
-- 3. Admin sees only coaches at their location(s):
--    SELECT DISTINCT primary_location_id FROM public.coaches;
--    -- Must only return location_ids in staff_locations for that admin.
--
-- 4. Admin sees only their assigned locations:
--    SELECT id FROM public.locations;
--    -- Must only return location_ids in staff_locations for that admin.
--
-- 5. Owner still sees all data in their tenant:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<owner_uid>","app_role":"owner","tenant_id":"<tid>"}';
--    SELECT COUNT(*) FROM public.bookings;
--    -- Must return all bookings in the tenant.
--
-- 6. Parent and coach still see all active coaches:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<parent_uid>","app_role":"parent","tenant_id":"<tid>"}';
--    SELECT COUNT(*) FROM public.coaches;
--    -- Must return all active coaches in the tenant.
--
-- ROLLBACK: run supabase/rollback/rollback_phase2_rls.sql
-- =============================================================================
