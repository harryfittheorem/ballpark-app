-- =============================================================================
-- Ballpark — Fix: add parent SELECT policy on coach_locations
-- =============================================================================
-- Parents need to read coach_locations to compute available booking slots
-- (listCoachAvailability in src/api/bookings.ts resolves which coaches are
-- assigned to a location before querying coach_availability). Without this
-- policy the query silently returns 0 rows for the parent role, causing all
-- three day columns in the Book tab to show no available slots.
--
-- Mirrors the pattern used for coach_locations_admin_select in
-- 20260521000001_coach_locations.sql, pinning tenant_id via the locations
-- table to maintain tenant isolation.
-- =============================================================================

DROP POLICY IF EXISTS coach_locations_select_parent ON public.coach_locations;

CREATE POLICY coach_locations_select_parent ON public.coach_locations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'parent'
    AND location_id IN (
      SELECT id FROM public.locations
       WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- =============================================================================
-- VALIDATION
-- =============================================================================
-- Run as a parent JWT in the Supabase SQL editor:
--
--   SET LOCAL "request.jwt.claims" TO
--     '{"sub":"<parent_user_id>","app_role":"parent","tenant_id":"<tenant_id>"}';
--   SELECT COUNT(*) FROM public.coach_locations;
--   -- Should return the count of coach_locations rows for that tenant.
-- =============================================================================
