-- =============================================================================
-- v0.6 — Grant the full public schema to service_role (task #86 prerequisite).
-- =============================================================================
-- PostgREST switches to the `service_role` Postgres role when called with
-- the SUPABASE_SERVICE_ROLE_KEY. Tables created via raw SQL migrations
-- inherit no GRANTs (see replit.md "Gotchas") and the only earlier patch
-- (20260507230000_grant_videos_to_service_role) covered just `videos`.
-- That left service_role unable to read most tables via PostgREST, which
-- blocks the Tenant 2 fixture provisioner and the cross-tenant audit
-- script — both need to look up parent families and discover per-tenant
-- probe row ids before any client-side test runs.
--
-- Granting ALL on every public table to service_role here matches the
-- implicit Supabase default (the dashboard's Table Editor relies on the
-- same access level) and removes the foot-gun of having to ship a GRANT
-- migration every time a new table lands.
--
-- Security posture: service_role has no client exposure — it never
-- travels in a JWT we send to a phone, only in SUPABASE_SERVICE_ROLE_KEY
-- which lives server-side. RLS is BYPASSED for service_role by Supabase
-- convention, so this GRANT only changes which verbs PostgREST will route
-- to that role; it does NOT change tenant boundaries (those are gated by
-- the role itself, not by the GRANTs).
-- =============================================================================

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES  TO service_role;
