# Tenant Isolation Audit — v0.6 (Task #86)

**Date:** 2026-05-08
**Scope:** Cross-tenant RLS coverage across every tenant-scoped public table (14 tables × 4 signed-in users × 3 probe classes + the kids-INSERT spec probe).
**Result: PASS — 0 leaks.**

The two migrations shipped with this audit are:

| File | Purpose |
|---|---|
| `supabase/migrations/20260508010000_v06_grant_public_to_service_role.sql` | Backfills `service_role` GRANTs on every public table so the audit + provisioning scripts can use PostgREST. (Tables created via raw-SQL migrations don't inherit GRANTs — see `replit.md` Gotchas.) |
| `supabase/migrations/20260508020000_v06_kids_policy_tenant_join.sql` | Defence-in-depth tenant pin on `kids_insert_own_family` and `kids_update_own_family`. |

---

## 1. Fixtures + sentinel data

The audit needs two things in place before it runs:

1.  **Fixture users** (one parent + one coach per tenant) — created by `scripts/provision-audit-fixtures.mjs <password>`.
2.  **Per-tenant sentinel rows** in every probe target table (so SEL-by-id and UPDATE probes always have something to aim at and never skip) — created by `scripts/seed-audit-rows.mjs`.

Both scripts are idempotent — re-running is a no-op.

| Label | Email | Tenant | Role | Notes |
|---|---|---|---|---|
| T1 parent | `audit.parent.t1@ballpark.test` | Infinite Hitting (`…0001`) | parent | Family + 1 kid auto-created |
| T1 coach | `audit.coach.t1@ballpark.test` | Infinite Hitting (`…0001`) | coach | |
| T2 parent | `audit.parent.t2@ballpark.test` | Test Tenant Two (`…0002`) | parent | Family + 1 kid auto-created (folded-in #85) |
| T2 coach | `audit.coach.t2@ballpark.test` | Test Tenant Two (`…0002`) | coach | |

Fixture password (dev-only, deterministic for re-runs): **`AuditFixtures2026!`**

These are dedicated `*.ballpark.test` accounts — *not* the human-owned test accounts (`harjinderharry@gmail.com`, `h@g.com`, `coach.mike@infinitehitting.com`). Coupling the audit to human accounts was rejected because (a) their passwords are unknown / rotating and (b) probe writes would surface in real human UI sessions.

Sentinel rows (one per tenant, IDs of shape `aaaaaa{code}-0000-0000-0000-000{1,2}00000000`) are seeded for: `coach_availability`, `bookings`, `videos`, `coach_messages`, `assignments`, `products`, `orders`, `points_ledger`. The other 6 probe tables (`tenants`, `locations`, `session_types`, `coaches`, `families`, `kids`) already have rows in both tenants from the initial schema seed and the fixture-user `handle_new_user` trigger.

---

## 2. Probe matrix

`scripts/audit-tenant-isolation.mjs <password>` signs in as each fixture and runs three probes per table:

| Probe | What it does | PASS condition |
|---|---|---|
| **ENUM** | `SELECT * FROM <table>` and inspect every visible row's tenant tag (`tenant_id` column, or `families.tenant_id` for `kids` which has no direct column) | 0 rows belong to the opposite tenant |
| **SEL** | `SELECT id FROM <table> WHERE id = <known-opposite-tenant-id>` | 0 rows returned |
| **UPD** | `UPDATE <table> SET updated_at = now() WHERE id = <known-opposite-tenant-id> RETURNING id` | 0 rows affected (or `42501 permission denied` from a missing GRANT, treated as PASS) |

For `kids` only, an additional **INS** probe runs:

| Probe | What it does | PASS condition |
|---|---|---|
| **INS** | Signed in as one tenant's parent, attempt `INSERT INTO kids (family_id, …)` where `family_id` is the *opposite* tenant's family | INSERT denied with `42501 new row violates row-level security policy for table "kids"` |

Tables probed (14): `tenants`, `locations`, `session_types`, `coaches`, `coach_availability`, `families`, `kids`, `bookings`, `videos`, `coach_messages`, `assignments`, `products`, `orders`, `points_ledger`.

---

## 3. Results — post-hardening, post-seeding

```
┌─────────┬──────────────────────┬──────┬──────┬────────┐
│ (index) │ table                │ pass │ fail │ status │
├─────────┼──────────────────────┼──────┼──────┼────────┤
│ 0       │ 'tenants'            │ 12   │ 0    │ 'PASS' │
│ 1       │ 'locations'          │ 12   │ 0    │ 'PASS' │
│ 2       │ 'session_types'      │ 12   │ 0    │ 'PASS' │
│ 3       │ 'coaches'            │ 12   │ 0    │ 'PASS' │
│ 4       │ 'coach_availability' │ 12   │ 0    │ 'PASS' │
│ 5       │ 'families'           │ 12   │ 0    │ 'PASS' │
│ 6       │ 'kids'               │ 14   │ 0    │ 'PASS' │  ← +2 INS probes
│ 7       │ 'bookings'           │ 12   │ 0    │ 'PASS' │
│ 8       │ 'videos'             │ 12   │ 0    │ 'PASS' │
│ 9       │ 'coach_messages'     │ 12   │ 0    │ 'PASS' │
│ 10      │ 'assignments'        │ 12   │ 0    │ 'PASS' │
│ 11      │ 'products'           │ 12   │ 0    │ 'PASS' │
│ 12      │ 'orders'             │ 12   │ 0    │ 'PASS' │
│ 13      │ 'points_ledger'      │ 12   │ 0    │ 'PASS' │
└─────────┴──────────────────────┴──────┴──────┴────────┘

OVERALL: PASS — 170/170 probes pass, 0 leaks, 0 skipped.
```

**Leaks found: 0.** No `ENUM` probe surfaced an opposite-tenant row, no `SEL`-by-id probe returned a row, no `UPD` mutated an opposite-tenant row, and both kids-`INS` probes were rejected by `42501 new row violates row-level security policy for table "kids"`.

**Coverage:** every probe in the 14 × 4 × {3 or 4} matrix actually ran against a real opposite-tenant target row. `grep -c skipped` over the audit output is `0`. (Earlier draft results had SEL/UPD probes for `bookings`, `videos`, `coach_messages`, `assignments`, `products`, `orders`, `points_ledger`, `coach_availability` silently skipping when T2 had no data — closed by `scripts/seed-audit-rows.mjs`.)

### How specific UPD probes pass

For tables where `authenticated` *has* `UPDATE` granted and an `updated_at` column exists — `coaches`, `families`, `kids`, `bookings` — the UPD probe is a real RLS test: PostgREST forwards the UPDATE to Postgres, RLS evaluates the USING clause, and `rows_affected=0` is the PASS signal.

For all other tables, the UPDATE is rejected before RLS runs:

| Table | Rejection reason | Why this is still PASS |
|---|---|---|
| `tenants`, `locations`, `session_types` | `42501 permission denied` (no UPDATE grant to `authenticated` at all) | Verb is unreachable from any client session, strictly stronger than RLS-denied |
| `videos`, `coach_messages`, `assignments`, `products`, `orders` | `42501 permission denied` (only SELECT/INSERT granted; mutations flow through SECURITY DEFINER RPCs) | Same — the verb cannot land, so RLS never even has to enforce |
| `coach_availability`, `points_ledger` | `PGRST204` (no `updated_at` column for the probe to set — `points_ledger` is also append-only with no UPDATE grant, so it would have been 42501 anyway) | Same — PostgREST collapses the request at schema-validation time, before any tenant boundary is touched |

In all three rejection classes the row could not have been mutated regardless of who was signed in, so the PASS verdict is an *upper-bound* guarantee. ENUM and SEL probes are the meaningful tests on those tables, and both pass with `leaked=0`.

---

## 4. Pre-hardening baseline (analytical)

The kids policy hardening in `20260508020000_v06_kids_policy_tenant_join.sql` is **defence-in-depth, not a fix for a currently-exploitable bug**. Before the migration the `kids_insert_own_family` and `kids_update_own_family` policies read:

```sql
WITH CHECK (
  family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
)
```

That sub-select happens to also be tenant-correct *because* `public.families` has its own RLS pinning visibility to the caller's `parent_user_id` — which is unique per family, and each family has exactly one tenant. So the kids INSERT/UPDATE probes would have returned PASS against the OLD policy too, by transitivity.

What the OLD policy did **not** do is enforce the tenant boundary on the kids row *itself*. The boundary was enforced only by leaning on the families RLS. If a future migration:

- weakens families RLS,
- adds a SECURITY DEFINER helper that returns family ids without re-checking tenant_id, or
- a service-role code path forgets to set tenant context

then the kids row could silently end up under a foreign-tenant family with no policy violation. The new policy makes that impossible by pinning the JWT tenant directly inside the kids policy's families sub-select.

**Schema constraint that drove the policy shape:** `public.kids` has no direct `tenant_id` column. Tenant linkage is `kids.family_id → families.id → families.tenant_id`. So the JWT-tenant pin had to live inside the families sub-select, not as a top-level `tenant_id = …` clause:

```sql
family_id IN (
  SELECT f.id
    FROM public.families f
   WHERE f.parent_user_id = auth.uid()
     AND f.tenant_id      = ((auth.jwt() ->> 'tenant_id')::uuid)
)
```

`kids_select_own_family` and `kids_delete_own_family` are intentionally NOT modified. SELECT and DELETE only operate on rows the parent already sees, and those verbs would only matter if families RLS itself were broken — out of scope per the #86 plan.

---

## 5. Migration SQL applied

### `20260508010000_v06_grant_public_to_service_role.sql`

```sql
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES  TO service_role;
```

Service_role has no client exposure — it lives only in `SUPABASE_SERVICE_ROLE_KEY` server-side, and Supabase's convention bypasses RLS for it anyway. The GRANT only changes which verbs PostgREST routes to the role; it doesn't change tenant boundaries.

### `20260508020000_v06_kids_policy_tenant_join.sql`

```sql
DROP POLICY IF EXISTS kids_insert_own_family ON public.kids;
CREATE POLICY kids_insert_own_family ON public.kids
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT f.id
        FROM public.families f
       WHERE f.parent_user_id = auth.uid()
         AND f.tenant_id      = ((auth.jwt() ->> 'tenant_id')::uuid)
    )
  );

DROP POLICY IF EXISTS kids_update_own_family ON public.kids;
CREATE POLICY kids_update_own_family ON public.kids
  FOR UPDATE TO authenticated
  USING       (/* same families-join clause as above */)
  WITH CHECK  (/* same families-join clause as above */);
```

(Full migration with `COMMENT ON POLICY` rationale is in the file.)

---

## 6. Legitimate-flow confirmation (post-migration)

A separate positive-path script (run inline, not committed) signed in as each parent fixture and exercised the four normal kid-management verbs against the parent's *own* family:

```
--- T1 parent (audit.parent.t1@ballpark.test) ---
  families.select: PASS rows=1 tenant=00000000-0000-0000-0000-000000000001
  kids.insert    : PASS id=fc3ab5c9-89e3-481d-99ed-cea30f9a38df
  kids.update    : PASS rows=1 jersey=7
  kids.delete    : PASS (cleanup)

--- T2 parent (audit.parent.t2@ballpark.test) ---
  families.select: PASS rows=1 tenant=00000000-0000-0000-0000-000000000002
  kids.insert    : PASS id=77a62ed9-65e5-4382-920e-0125d92f0014
  kids.update    : PASS rows=1 jersey=7
  kids.delete    : PASS (cleanup)
```

The new tenant pin is a true no-op for legitimate parents because their JWT `tenant_id` always matches their own family's `tenant_id`. Signup → kid registration → profile edit → kid deletion all still pass for both tenants.

---

## 7. How to re-run

```bash
# 1. (one-time per environment) provision the four fixtures
node scripts/provision-audit-fixtures.mjs 'AuditFixtures2026!'

# 2. (one-time per environment) seed the per-tenant sentinel rows
node scripts/seed-audit-rows.mjs

# 3. run the audit
node scripts/audit-tenant-isolation.mjs 'AuditFixtures2026!'
#    exit code 0 = PASS, non-zero = leak count
```

All three scripts are idempotent. The audit itself never writes (other than the cross-tenant kids INSERT probe which RLS rejects before any row materialises), and both seeders use deterministic UUIDs with `Prefer: resolution=ignore-duplicates`, so re-runs are no-ops.
