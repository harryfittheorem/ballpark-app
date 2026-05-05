-- =============================================================================
-- Grant base table privileges to authenticated / anon roles
-- =============================================================================
-- Bug: tables created via raw `CREATE TABLE` in migrations do NOT inherit the
-- default GRANTs that Supabase Studio applies when you create tables through
-- the dashboard. RLS is enforced *on top of* base table privileges — without
-- a base GRANT on the role, PostgREST returns 403 with
-- `code: 42501, message: permission denied for table <name>` before any RLS
-- policy ever runs.
--
-- Repro:
--   curl ${url}/rest/v1/families?... -H "Authorization: Bearer <user JWT>"
--   -> 403 permission denied for table families
--
-- Fix: GRANT the appropriate privileges to `authenticated` (logged-in users)
-- and SELECT-only to `anon` for tables we want public-readable. RLS policies
-- already in place will narrow the rows each role can actually see/modify.
--
-- Privilege model (matches RLS scope already defined):
--   tenants    authenticated: SELECT
--   locations  authenticated: SELECT
--   families   authenticated: SELECT, UPDATE  (no INSERT — handled by trigger)
--   kids       authenticated: SELECT, INSERT, UPDATE, DELETE
--   coaches    authenticated: SELECT, UPDATE
-- =============================================================================

-- Per-table grants (deliberate; do not blanket-grant ALL).
GRANT SELECT                          ON public.tenants   TO authenticated;
GRANT SELECT                          ON public.locations TO authenticated;
GRANT SELECT, UPDATE                  ON public.families  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.kids      TO authenticated;
GRANT SELECT, UPDATE                  ON public.coaches   TO authenticated;
