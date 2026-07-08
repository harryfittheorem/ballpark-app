-- Durable audit log for manual staff overrides on memberships
-- (e.g. reset-failure-count with an explanatory note).
-- NOTE: Originally 20260708120000; renamed to 20260708120001 to resolve a
-- timestamp collision with membership_billing_date_changes. All statements
-- are idempotent — the table may already exist from the 000004 fix migration.

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

-- RLS: only service-role writes; owners can read their own tenant's events
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
