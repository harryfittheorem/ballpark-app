-- =============================================================================
-- Fix: membership_admin_events table creation
-- =============================================================================
-- The original migration (20260708120000_membership_admin_events.sql) was
-- recorded as applied in the migration history due to a timestamp collision,
-- but the table was never created. This migration re-applies it idempotently.
-- =============================================================================

CREATE TABLE IF NOT EXISTS membership_admin_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id UUID        NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  note          TEXT,
  created_by    TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_admin_events_membership
  ON membership_admin_events(membership_id);

CREATE INDEX IF NOT EXISTS idx_membership_admin_events_tenant
  ON membership_admin_events(tenant_id, created_at DESC);

ALTER TABLE membership_admin_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "owners can read their tenant admin events"
    ON membership_admin_events FOR SELECT
    TO authenticated
    USING (
      tenant_id = (
        SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

GRANT SELECT ON membership_admin_events TO authenticated;
