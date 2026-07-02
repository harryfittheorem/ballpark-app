# Ballpark Ops Runbook

Operational procedures for the Ballpark production environment. For architecture, see `ARCHITECTURE.md`. For HitTrax setup, see `HITTRAX_INTEGRATION.md`.

---

## One-time environment setup

### GUC setup for pg_cron → Edge Function calls

Several nightly cron jobs call Supabase Edge Functions via `pg_net`. The call URL and auth header are built at runtime from two Postgres GUCs:

| GUC | Value |
|-----|-------|
| `app.settings.supabase_url` | `https://<project-ref>.supabase.co` |
| `app.settings.service_role_key` | Service role key from Supabase → Settings → API |

**This must be run once per environment** (dev and production separately) before the cron jobs will fire:

```bash
node scripts/setup-cron-guc.mjs
```

Required env vars: `EXPO_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`.

The script sets the GUCs, calls `pg_reload_conf()`, and verifies both cron jobs are registered.

**Manual SQL alternative** (run in Supabase SQL Editor):
```sql
ALTER DATABASE postgres SET "app.settings.supabase_url"     = 'https://<ref>.supabase.co';
ALTER DATABASE postgres SET "app.settings.service_role_key" = '<service-role-key>';
SELECT pg_reload_conf();
```

---

## Cron jobs

### `process-membership-cancellations-daily`
- **Schedule:** `0 2 * * *` (daily at 02:00 UTC)
- **Function:** `process-membership-cancellations`
- **What it does:** Finds memberships where `cancel_effective_at <= NOW()` and status ≠ `cancelled`. For each: deletes the Stripe subscription, sets `status = 'cancelled'` and `cancelled_at = now()`.
- **Returns:** `{ processed: N, cancelled: N, skipped: N, errors: [...] }`

**Verify it's registered:**
```sql
SELECT jobname, schedule, active FROM cron.job
 WHERE jobname = 'process-membership-cancellations-daily';
```

**Manual trigger (for testing):**
```bash
curl -X POST https://<ref>.supabase.co/functions/v1/process-membership-cancellations \
  -H "Authorization: Bearer <service-role-key>"
```

**Smoke test — insert a due membership and trigger:**
```sql
-- In SQL Editor, update an existing test membership
UPDATE memberships
   SET cancel_effective_at = now() - interval '1 hour',
       cancel_requested_at = now() - interval '31 days'
 WHERE id = '<test-membership-uuid>';
```
Then trigger manually and verify the row transitions to `status = 'cancelled'`.

---

### `resume-paused-memberships-daily`
- **Schedule:** `0 6 * * *` (daily at 06:00 UTC)
- **Function:** `resume-paused-memberships`
- **What it does:** Finds memberships where `status = 'paused'` and `pause_end <= today`. For each: removes Stripe `pause_collection`, sets `status = 'active'` and clears pause columns.

**Verify it's registered:**
```sql
SELECT jobname, schedule, active FROM cron.job
 WHERE jobname = 'resume-paused-memberships-daily';
```

**Manual trigger:**
```bash
curl -X POST https://<ref>.supabase.co/functions/v1/resume-paused-memberships \
  -H "Authorization: Bearer <service-role-key>"
```

---

### `hittrax-poll` (every 2 min)
- **Schedule:** `*/2 * * * *`
- **Function:** `hittrax-poll`
- **What it does:** Polls HitTrax for new sessions/swings for every linked kid.

---

## Post-merge checklist

After every task merge, `scripts/post-merge.sh` runs automatically. It:
1. `npm install --legacy-peer-deps`
2. `supabase db push` (applies new migrations)
3. Regenerates `src/types/database.ts`
4. Deploys all edge functions via `supabase functions deploy --use-api`
5. Rebuilds the portal (`cd portal && npm run build`)

If the portal build shows `Module not found: @stripe/react-stripe-js`, run:
```bash
cd portal && npm install --legacy-peer-deps && npm run build
```

---

## Seed data

| Script | Purpose |
|--------|---------|
| `node scripts/seed-portal-demo-data.mjs` | 4 coaches, 15 families, 12-month payment history |
| `node scripts/seed-demo-scenario.mjs` | Marcus Rivera hero story for CEO demos |
| `node scripts/seed-coach-mike-sessions.mjs` | 6 upcoming bookings for Coach Mike |
| `node scripts/delete-portal-seed-data.mjs` | Remove all 5eed… namespace records |
| `node scripts/delete-demo-scenario.mjs` | Remove all de00… namespace records |

All seed scripts require `EXPO_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## Backfill scripts

| Script | When to run |
|--------|-------------|
| `node scripts/backfill-card-shadow-columns.mjs` | After bulk enrollment imports — populates `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` for families with `stripe_connected_customer_id` but no card on file in the DB. |
| `node scripts/backfill-stripe-invoices.mjs` | When adding a new location — imports past 12 months of Stripe invoices into `payment_events`. |

---

## Cross-tenant RLS audit

```bash
node scripts/audit-tenant-isolation.mjs 'AuditFixtures2026!'
```

One-time setup per environment:
```bash
node scripts/provision-audit-fixtures.mjs 'AuditFixtures2026!'
node scripts/seed-audit-rows.mjs
```

Full results and methodology: `docs/TENANT_ISOLATION_AUDIT.md`.
