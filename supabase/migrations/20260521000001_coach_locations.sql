-- =============================================================================
-- Ballpark — Phase 1c: coach_locations junction table
-- =============================================================================
-- Adds a coach_locations junction table so a coach can be linked to multiple
-- locations. coaches.primary_location_id is LEFT UNCHANGED and remains the
-- source of truth for all Phase 1 queries.
--
-- Backfills one row per coach whose primary_location_id is non-null.
-- All four RLS policies are defined below.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.coach_locations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid        NOT NULL REFERENCES public.coaches(id)   ON DELETE CASCADE,
  location_id uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  is_primary  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_locations_unique_pair UNIQUE (coach_id, location_id)
);


-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_coach_locations_coach_id    ON public.coach_locations(coach_id);
CREATE INDEX idx_coach_locations_location_id ON public.coach_locations(location_id);


-- -----------------------------------------------------------------------------
-- 3. Backfill: one row per coach with a non-null primary_location_id
--    is_primary = true mirrors coaches.primary_location_id.
--    ON CONFLICT DO NOTHING makes this idempotent on re-run.
-- -----------------------------------------------------------------------------
INSERT INTO public.coach_locations (coach_id, location_id, is_primary)
SELECT id, primary_location_id, true
  FROM public.coaches
 WHERE primary_location_id IS NOT NULL
ON CONFLICT (coach_id, location_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.coach_locations ENABLE ROW LEVEL SECURITY;

-- Coaches can SELECT their own rows.
CREATE POLICY coach_locations_select_own ON public.coach_locations
  FOR SELECT TO authenticated
  USING (
    coach_id IN (
      SELECT id FROM public.coaches WHERE user_id = auth.uid()
    )
  );

-- Owners can SELECT all rows scoped to their tenant's locations.
CREATE POLICY coach_locations_owner_select ON public.coach_locations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND location_id IN (
      SELECT id FROM public.locations
       WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Admins can SELECT all rows scoped to their tenant's locations.
CREATE POLICY coach_locations_admin_select ON public.coach_locations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND location_id IN (
      SELECT id FROM public.locations
       WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Owners and admins can INSERT / UPDATE / DELETE rows scoped to their tenant.
CREATE POLICY coach_locations_owner_manage ON public.coach_locations
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
    AND location_id IN (
      SELECT id FROM public.locations
       WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
    AND location_id IN (
      SELECT id FROM public.locations
       WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );


-- -----------------------------------------------------------------------------
-- 5. Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_locations TO authenticated;


-- =============================================================================
-- VALIDATION QUERIES (run manually after applying to staging)
-- =============================================================================
-- 1. Backfill count should equal the number of coaches with primary_location_id:
--
--    SELECT COUNT(*) AS backfilled FROM public.coach_locations WHERE is_primary = true;
--    SELECT COUNT(*) AS source     FROM public.coaches WHERE primary_location_id IS NOT NULL;
--    -- Both counts must be equal.
--
-- 2. Row-level check — a coach user can only see their own row(s):
--    (Run as a coach JWT in psql or Supabase SQL editor with set role authenticated)
--
--    SET LOCAL "request.jwt.claims" TO '{"sub":"<coach_user_id>","app_role":"coach","tenant_id":"<tenant_id>"}';
--    SELECT * FROM public.coach_locations;
--    -- Should return only rows where coach_id = that coach's coaches.id.
--
-- 3. Owner visibility — an owner can see all rows in their tenant:
--
--    SET LOCAL "request.jwt.claims" TO '{"sub":"<owner_user_id>","app_role":"owner","tenant_id":"<tenant_id>"}';
--    SELECT COUNT(*) FROM public.coach_locations;
--    -- Should return all coach_locations rows for that tenant.
-- =============================================================================


-- =============================================================================
-- ROLLBACK SQL
-- =============================================================================
-- Safe to run in Phase 1 because no production query reads from this table.
--
--    DROP TABLE public.coach_locations CASCADE;
--
-- The CASCADE will drop the indexes, the UNIQUE constraint, and the RLS
-- policies along with the table. coaches.primary_location_id is unaffected.
-- =============================================================================
