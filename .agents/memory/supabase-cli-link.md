---
name: Supabase CLI project link
description: Confirm the Supabase target and explicitly link the CLI before remote database operations.
---

## Rule
The user confirmed on 2026-11-20 that `ballpark-app` is development-only and serves no live customers. Earlier notes calling it production were inaccurate. It is shared by this app and its task forks, not an isolated database for each fork.

**CLI query rule:** `supabase db query` defaults to the local target. Use `--linked` explicitly and put SQL after `--`, especially when a migration starts with a SQL comment.

**Why:** the CLI otherwise treats leading SQL comments as command flags, and a configured project link alone does not select remote query execution.

**Integration rule:** minimal SQL fixtures prove focused logic, not compatibility with the shared app's real schema and triggers.

**Why:** fixture-only scheduling checks missed real tenancy and gamification behavior. Confirm integration against the approved development target before declaring booking/attendance changes complete; never substitute customer data for a development test tenant.

**Why:** The user explicitly clarified the environment before authorizing scheduling migrations and test bookings.

**How to apply:** Verify the intended target before remote changes. Do not infer a live deployment or isolated testing environment from the project name.

Before running `npx supabase db push` or remote `npx supabase db query`, explicitly link to the confirmed target:

```bash
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase link \
  --project-ref exjcwvvglthnxerzpukw \
  --password "$SUPABASE_DB_PASSWORD"
```

Without this, commands can target a stale local "workspace" link and misleadingly report that no migrations remain. Use `db query --linked` for a remote query; its default is local.

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
