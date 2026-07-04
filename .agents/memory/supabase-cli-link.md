---
name: Supabase CLI project link
description: The CLI defaults to a local "workspace" project; must be explicitly linked to production before db push or db query.
---

## Rule
Before running `npx supabase db push` or `npx supabase db query`, always link to the real production project:

```bash
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase link \
  --project-ref exjcwvvglthnxerzpukw \
  --password "$SUPABASE_DB_PASSWORD"
```

Without this, `db push` connects to a non-existent local container and reports "Remote database is up to date" even when production is out of sync.

## Verifying schema via Management API (when psql/db-query fail)
Direct postgres connections (ports 5432/6543) may be blocked in the Replit sandbox. Use the Management API instead:

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/exjcwvvglthnxerzpukw/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name FROM information_schema.columns WHERE table_schema='"'"'public'"'"' AND table_name='"'"'memberships'"'"';"}'
```

Returns `[]` for DDL success; returns column rows for SELECT.

## Known gap: migration tracking vs. reality
Migration `20260515000000_subscription_billing_phase3.sql` was recorded as applied in `supabase_migrations.schema_migrations` but the columns were never created (likely a transaction rollback from the DO block that drops/recreates the status CHECK constraint). Columns were manually added via the Management API.

**Why:** Supabase CLI marks a migration as applied before or at the start of execution. If the migration transaction rolls back, the tracking row remains, so `db push` skips it forever.

**How to apply:** For columns the CLI won't re-apply, run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` directly via the Management API curl above.
