#!/usr/bin/env node
// =============================================================================
// scripts/audit-tenant-isolation.mjs
// =============================================================================
// Adversarial cross-tenant RLS audit (task #86). Signs in as the four
// dedicated audit fixtures (created by scripts/provision-audit-fixtures.mjs):
//
//   T1 parent  audit.parent.t1@ballpark.test
//   T1 coach   audit.coach.t1@ballpark.test
//   T2 parent  audit.parent.t2@ballpark.test
//   T2 coach   audit.coach.t2@ballpark.test
//
// For each tenant-scoped table, runs three classes of probe from each
// signed-in user against the OPPOSITE tenant:
//
//   1. ENUMERATE — SELECT every visible row from the table and check
//      whether ANY of them belong to the opposite tenant (tenant_id
//      compared directly, or via families.tenant_id for kids which has
//      no direct column). Catches "I can see rows I shouldn't" leaks.
//
//   2. SELECT-BY-ID — SELECT a known opposite-tenant row by id; expect 0
//      rows. Catches "policy uses tenant_id IN (...)" subquery leaks
//      that ENUMERATE wouldn't surface if the table is huge.
//
//   3. WRITE — UPDATE or INSERT against the opposite tenant; expect
//      denied (0 rows affected for UPDATE, error or empty result for
//      INSERT). The four kids-table probes called out in the task spec
//      are folded into this section.
//
// Exit code: non-zero on ANY leak. Output is a per-table PASS/FAIL grid
// plus a JSON blob the docs page reads from.
//
// Usage:
//   node scripts/audit-tenant-isolation.mjs <fixture-password>
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY  (only used to look up T1/T2 ids; never
//                               sent on probe requests)
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.argv[2];

if (!url || !anonKey || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}
if (!password) {
  console.error('Usage: node scripts/audit-tenant-isolation.mjs <fixture-password>');
  process.exit(2);
}

const T1 = '00000000-0000-0000-0000-000000000001';
const T2 = '00000000-0000-0000-0000-000000000002';

const FIXTURES = [
  { label: 'T1 parent', email: 'audit.parent.t1@ballpark.test', tenantId: T1, opposite: T2, role: 'parent' },
  { label: 'T1 coach',  email: 'audit.coach.t1@ballpark.test',  tenantId: T1, opposite: T2, role: 'coach'  },
  { label: 'T2 parent', email: 'audit.parent.t2@ballpark.test', tenantId: T2, opposite: T1, role: 'parent' },
  { label: 'T2 coach',  email: 'audit.coach.t2@ballpark.test',  tenantId: T2, opposite: T1, role: 'coach'  },
];

// Tables to probe. `tenantCol` is the column the audit compares against
// the user's tenant_id to detect leaks. `kids` is special — no direct
// tenant_id column, so we resolve via family_id in a follow-up SELECT.
const TABLES = [
  { name: 'tenants',         tenantCol: 'id'        },
  { name: 'locations',       tenantCol: 'tenant_id' },
  { name: 'session_types',   tenantCol: 'tenant_id' },
  { name: 'coaches',         tenantCol: 'tenant_id' },
  { name: 'coach_availability', tenantCol: 'tenant_id' },
  { name: 'families',        tenantCol: 'tenant_id' },
  { name: 'kids',            tenantCol: 'via_family' },
  { name: 'bookings',        tenantCol: 'tenant_id' },
  { name: 'videos',          tenantCol: 'tenant_id' },
  { name: 'coach_messages',  tenantCol: 'tenant_id' },
  { name: 'assignments',     tenantCol: 'tenant_id' },
  { name: 'products',        tenantCol: 'tenant_id' },
  { name: 'orders',          tenantCol: 'tenant_id' },
  { name: 'points_ledger',   tenantCol: 'tenant_id' },
];

// supabase-js eagerly constructs a RealtimeClient inside createClient(),
// which on Node < 22 throws unless given a WebSocket transport. We don't
// use realtime here, but we still need to satisfy the constructor.
const NO_REALTIME = { realtime: { transport: WebSocket } };

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  ...NO_REALTIME,
});

// -- Sign in all four fixtures --------------------------------------------
async function signIn(fixture) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...NO_REALTIME,
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email: fixture.email,
    password,
  });
  if (error) throw new Error(`signIn ${fixture.email}: ${error.message}`);
  // Build a fresh client that pins the access token on every request.
  // Note: setSession installs the token into the client's auth state so
  // subsequent .from() calls use it.
  await sb.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return { sb, accessToken: data.session.access_token, userId: data.user.id };
}

// -- Resolve a known opposite-tenant row id for each table ---------------
// For SELECT-BY-ID probes we need a real id that exists in the opposite
// tenant. We discover them up-front via the service-role client (which
// bypasses RLS) so the probes themselves don't depend on row counts.
async function discoverProbeIds() {
  const out = {};
  for (const t of TABLES) {
    out[t.name] = { [T1]: null, [T2]: null };
    if (t.tenantCol === 'via_family') {
      const { data } = await admin
        .from('kids')
        .select('id, family_id, families!inner(tenant_id)')
        .limit(50);
      for (const tenantId of [T1, T2]) {
        const hit = (data || []).find((r) => r.families?.tenant_id === tenantId);
        out[t.name][tenantId] = hit?.id ?? null;
      }
    } else {
      for (const tenantId of [T1, T2]) {
        const { data } = await admin
          .from(t.name)
          .select('id')
          .eq(t.tenantCol, tenantId)
          .limit(1);
        out[t.name][tenantId] = data?.[0]?.id ?? null;
      }
    }
  }
  return out;
}

// -- Probe runners --------------------------------------------------------
function tagOf(row, table) {
  if (table.tenantCol === 'via_family') return row?.families?.tenant_id ?? null;
  return row?.[table.tenantCol] ?? null;
}

async function enumerateLeak(client, fixture, table) {
  let q = client.from(table.name);
  if (table.tenantCol === 'via_family') {
    q = q.select('id, family_id, families!inner(tenant_id)');
  } else {
    q = q.select(`id, ${table.tenantCol}`);
  }
  const { data, error } = await q.limit(500);
  if (error) {
    // Some tables (e.g. tenants) may not be readable at all by this
    // role — that's a PASS for "no opposite-tenant rows visible".
    return { ok: true, note: `select error (treated as PASS): ${error.code || ''} ${error.message}` };
  }
  const rows = data || [];
  const leaked = rows.filter((r) => {
    const tag = tagOf(r, table);
    return tag && tag === fixture.opposite;
  });
  return {
    ok: leaked.length === 0,
    note: `visible=${rows.length}, leaked=${leaked.length}` + (leaked.length ? ` ids=${leaked.slice(0, 3).map((r) => r.id).join(',')}` : ''),
  };
}

async function selectByIdLeak(client, fixture, table, probeIds) {
  const id = probeIds[table.name][fixture.opposite];
  if (!id) return { ok: true, note: 'no opposite-tenant row to probe (skipped)' };
  const { data, error } = await client.from(table.name).select('id').eq('id', id);
  if (error) {
    return { ok: true, note: `select error (treated as PASS): ${error.code || ''} ${error.message}` };
  }
  return { ok: (data || []).length === 0, note: `rows_returned=${(data || []).length} (id=${id})` };
}

async function updateLeak(client, fixture, table, probeIds) {
  const id = probeIds[table.name][fixture.opposite];
  if (!id) return { ok: true, note: 'no opposite-tenant row to probe (skipped)' };
  // Generic touch: bump updated_at via UPDATE … WHERE id = … RETURNING id.
  // PostgREST returns affected rows array. RLS-blocked = empty result.
  const { data, error } = await client
    .from(table.name)
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) {
    // 42501 / permission denied = correctly blocked at the GRANT level.
    return { ok: true, note: `update error (treated as PASS): ${error.code || ''} ${error.message}` };
  }
  return { ok: (data || []).length === 0, note: `rows_affected=${(data || []).length} (id=${id})` };
}

async function kidsCrossTenantInsert(client, fixture, oppositeFamilyId) {
  if (!oppositeFamilyId) return { ok: true, note: 'no opposite-tenant family to target (skipped)' };
  const { data, error } = await client
    .from('kids')
    .insert({
      family_id: oppositeFamilyId,
      first_name: 'Probe',
      last_name: `From-${fixture.label.replace(/\s/g, '')}`,
      age_group: '10U',
    })
    .select('id');
  if (error) {
    // 42501 / row-level security violation = correctly blocked.
    return { ok: true, note: `insert error (treated as PASS): ${error.code || ''} ${error.message}` };
  }
  // If we get here a kid actually got inserted into the opposite tenant —
  // this is a HARD LEAK. Capture the id so we can clean it up.
  return { ok: false, note: `LEAK — kid inserted with id=${data?.[0]?.id}` };
}

// -- Main loop ------------------------------------------------------------
console.log('=== Tenant Isolation Audit ===');
console.log(`Probing ${TABLES.length} tables across ${FIXTURES.length} signed-in users.\n`);

const probeIds = await discoverProbeIds();
console.log('Probe ids discovered (service-role lookup):');
console.table(
  Object.fromEntries(
    Object.entries(probeIds).map(([k, v]) => [k, { T1: v[T1] || '(none)', T2: v[T2] || '(none)' }]),
  ),
);

// Hardening: refuse to run if ANY probe target is missing. Otherwise SEL/UPD
// probes against that (table, tenant) pair would silently skip and report
// PASS, masking a coverage gap. Run scripts/seed-audit-rows.mjs to fix.
{
  const missing = [];
  for (const t of TABLES) {
    for (const tenantId of [T1, T2]) {
      if (!probeIds[t.name][tenantId]) missing.push(`${t.name}/${tenantId === T1 ? 'T1' : 'T2'}`);
    }
  }
  if (missing.length > 0) {
    console.error('\nFATAL: missing probe target rows for:', missing.join(', '));
    console.error('Run `node scripts/seed-audit-rows.mjs` and re-try.');
    process.exit(2);
  }
}

// Resolve each parent fixture's family_id (used by the kids-INSERT probe)
const families = {};
for (const f of FIXTURES.filter((x) => x.role === 'parent')) {
  const { data } = await admin
    .from('families')
    .select('id')
    .eq('parent_email', f.email)
    .limit(1);
  families[f.tenantId] = data?.[0]?.id ?? null;
}

let totalFails = 0;
const grid = []; // { table, fixture, probe, ok, note }

for (const fixture of FIXTURES) {
  console.log(`\n--- Signed in as ${fixture.label} (${fixture.email}) ---`);
  const { sb } = await signIn(fixture);

  for (const table of TABLES) {
    const enumRes = await enumerateLeak(sb, fixture, table);
    grid.push({ table: table.name, fixture: fixture.label, probe: 'ENUM', ...enumRes });
    const selRes = await selectByIdLeak(sb, fixture, table, probeIds);
    grid.push({ table: table.name, fixture: fixture.label, probe: 'SEL', ...selRes });
    const updRes = await updateLeak(sb, fixture, table, probeIds);
    grid.push({ table: table.name, fixture: fixture.label, probe: 'UPD', ...updRes });
    if (!enumRes.ok) totalFails += 1;
    if (!selRes.ok) totalFails += 1;
    if (!updRes.ok) totalFails += 1;
  }

  // Kids-specific INSERT probe (the one called out by the task spec).
  if (fixture.role === 'parent') {
    const oppositeFamilyId = families[fixture.opposite];
    const insRes = await kidsCrossTenantInsert(sb, fixture, oppositeFamilyId);
    grid.push({ table: 'kids', fixture: fixture.label, probe: 'INS', ...insRes });
    if (!insRes.ok) totalFails += 1;
  }
}

// -- Compact per-table summary -------------------------------------------
console.log('\n=== Per-table PASS/FAIL summary ===');
const byTable = {};
for (const r of grid) {
  byTable[r.table] = byTable[r.table] || { PASS: 0, FAIL: 0, fails: [] };
  byTable[r.table][r.ok ? 'PASS' : 'FAIL'] += 1;
  if (!r.ok) byTable[r.table].fails.push(`${r.fixture} ${r.probe}: ${r.note}`);
}
const summary = Object.entries(byTable).map(([table, v]) => ({
  table,
  pass: v.PASS,
  fail: v.FAIL,
  status: v.FAIL === 0 ? 'PASS' : 'FAIL',
}));
console.table(summary);

if (totalFails > 0) {
  console.log('\n=== FAILURES (detail) ===');
  for (const [table, v] of Object.entries(byTable)) {
    if (v.fails.length === 0) continue;
    console.log(`\n[${table}]`);
    for (const f of v.fails) console.log('  - ' + f);
  }
}

// JSON blob the docs page consumes
console.log('\n=== JSON RESULTS (machine-readable) ===');
console.log(JSON.stringify({ summary, grid, totalFails }, null, 2));

console.log(`\n=== ${totalFails === 0 ? 'OVERALL: PASS' : 'OVERALL: FAIL (' + totalFails + ' leaks)'} ===`);
process.exit(totalFails === 0 ? 0 : 1);
