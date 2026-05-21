-- =============================================================================
-- Ballpark — Phase 2, Step 1: staff_locations table
-- =============================================================================
-- Junction table that tracks which locations each admin/owner portal user
-- is assigned to. Owners are tenant-wide by role; admins are scoped to
-- their staff_locations entries.
--
-- A separate backfill script (scripts/backfill-staff-locations.mjs) must be
-- run and confirmed complete BEFORE applying step 3
-- (20260601000003_phase2_admin_rls_staff_locations.sql). Running that
-- migration without completing the backfill will lock admins out of their
-- own data.
--
-- Do NOT include the backfill in this migration — it must be a separate,
-- audited, human-run step.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.staff_locations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_locations_unique_pair UNIQUE (user_id, location_id)
);


-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_staff_locations_user_id    ON public.staff_locations(user_id);
CREATE INDEX idx_staff_locations_tenant_id  ON public.staff_locations(tenant_id);
CREATE INDEX idx_staff_locations_location_id ON public.staff_locations(location_id);


-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.staff_locations ENABLE ROW LEVEL SECURITY;

-- Owners can SELECT all rows for their tenant.
CREATE POLICY staff_locations_owner_select ON public.staff_locations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Admins can SELECT their own rows (to know which locations they manage).
CREATE POLICY staff_locations_admin_select_own ON public.staff_locations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND user_id = auth.uid()
  );

-- Owners can manage all staff_locations for their tenant.
-- WITH CHECK enforces that location_id also belongs to the same tenant,
-- preventing insertion of (tenant_id, foreign_location_id) pairs even when
-- the owner knows a location UUID from another tenant.
CREATE POLICY staff_locations_owner_manage ON public.staff_locations
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.locations l
       WHERE l.id = location_id
         AND l.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Super admin: cross-tenant visibility.
CREATE POLICY staff_locations_super_admin ON public.staff_locations
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');


-- -----------------------------------------------------------------------------
-- 4. Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_locations TO authenticated;


-- =============================================================================
-- VALIDATION QUERIES (run after applying + running backfill script)
-- =============================================================================
-- 1. Confirm backfill row count matches admin users:
--
--    SELECT COUNT(*) FROM public.staff_locations;
--    -- Should equal total admin-user × location assignments seeded.
--
-- 2. Confirm owner can see all rows in their tenant:
--
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<owner_uid>","app_role":"owner","tenant_id":"<tid>"}';
--    SELECT COUNT(*) FROM public.staff_locations;
--
-- 3. Confirm admin only sees their own rows:
--
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<admin_uid>","app_role":"admin","tenant_id":"<tid>"}';
--    SELECT * FROM public.staff_locations;
--    -- Must only return rows where user_id = <admin_uid>.
-- =============================================================================
