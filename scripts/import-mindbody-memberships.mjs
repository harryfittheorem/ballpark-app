#!/usr/bin/env node
// =============================================================================
// scripts/import-mindbody-memberships.mjs
// =============================================================================
// Imports MindBody "Memberships" CSV export into Ballpark memberships table.
//
// CSV columns (standard MindBody export):
//   ClientID, ContractName, StartDate, EndDate, AutoRenew, Status, AutoPayAmount
//
// Mapping rules:
//   - ContractName → Ballpark plan_name + plan_type via mindbody-plan-map.json
//   - Status=Active + AutoRenew=Yes → status='active', plan_type='eft'
//   - Status=Active + AutoRenew=No  → status='active', plan_type='otc'
//   - Status=Cancelled/Expired      → status='cancelled'
//   - AutoPayAmount                 → amount_cents (dollars × 100)
//
// Idempotency: membership ID = UUID v5(MB_NS, "membership:{clientId}:{contractName}:{startDate}")
//
// Usage:
//   node scripts/import-mindbody-memberships.mjs \
//     --input scripts/fixtures/mindbody-memberships-sample.csv \
//     [--plan-map scripts/mindbody-plan-map.json] \
//     [--dry-run] \
//     [--tenant-slug infinitehitting]
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { createHash }   from 'crypto';
import { createReadStream } from 'fs';
import { createInterface }  from 'readline';
import { readFile }         from 'fs/promises';
import { resolve }          from 'path';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MB_NS        = '00000000-0000-5000-8000-6d696e64626f';

// =============================================================================
// Args
// =============================================================================

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const inputIdx    = args.indexOf('--input');
const INPUT       = inputIdx !== -1 ? args[inputIdx + 1] : null;
const planMapIdx  = args.indexOf('--plan-map');
const PLAN_MAP_PATH = planMapIdx !== -1 ? args[planMapIdx + 1]
  : resolve('scripts/mindbody-plan-map.json');
const slugIdx     = args.indexOf('--tenant-slug');
const TENANT_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : (process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'infinitehitting');

if (!INPUT) { console.error('ERROR: --input <path> is required.'); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// UUID v5
// =============================================================================

function uuidV5(namespace, name) {
  const nsHex   = namespace.replace(/-/g, '');
  const nsBytes = Buffer.from(nsHex, 'hex');
  const hash = createHash('sha1').update(nsBytes).update(Buffer.from(name, 'utf8')).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function mbKidId(clientId)          { return uuidV5(MB_NS, `kid:${clientId}`); }
function mbMembershipId(clientId, contractName, startDate) {
  return uuidV5(MB_NS, `membership:${clientId}:${contractName}:${startDate}`);
}

// =============================================================================
// CSV parser
// =============================================================================

async function parseCSV(filePath) {
  const rows  = [];
  const rl    = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = splitCSVLine(trimmed);
    if (!headers) { headers = cols.map(h => h.trim()); continue; }
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

// =============================================================================
// REST helpers
// =============================================================================

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function restGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...baseHeaders, Prefer: 'return=representation' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return []; }
}

async function restInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`INSERT ${table} → ${res.status}: ${t}`);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function parseMoney(str) {
  const n = parseFloat((str ?? '').replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function toISODate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function mapStatus(row) {
  const status = (row.Status ?? '').toLowerCase();
  if (status === 'active') return 'active';
  if (status === 'cancelled' || status === 'expired') return 'cancelled';
  return 'cancelled';
}

// =============================================================================
// Main
// =============================================================================

console.log(`\n${'='.repeat(65)}`);
console.log('MindBody Memberships Import' + (DRY_RUN ? '  [DRY-RUN]' : ''));
console.log('='.repeat(65));
console.log(`Input:     ${INPUT}`);
console.log(`Plan map:  ${PLAN_MAP_PATH}`);

const planMapRaw = JSON.parse(await readFile(PLAN_MAP_PATH, 'utf8'));
const PLAN_MAP   = planMapRaw;

const rows = await parseCSV(INPUT);
console.log(`Rows read: ${rows.length}`);

// ── Build membership rows ──────────────────────────────────────────────────────
const report = { mapped: 0, unmapped: 0, active: 0, cancelled: 0 };
const unmappedContracts = new Set();
const membershipRows = [];

for (const row of rows) {
  const contractName = (row.ContractName ?? '').trim();
  const planEntry    = PLAN_MAP[contractName];

  if (!planEntry) {
    unmappedContracts.add(contractName);
    report.unmapped++;
    continue;
  }

  const autoRenew  = (row.AutoRenew ?? '').toLowerCase();
  // AutoRenew=Yes → EFT (recurring autopay). AutoRenew=No → OTC (one-time /
  // non-recurring), regardless of what the plan-map says. This ensures
  // active non-autorenew contracts are never mistakenly marked as eft.
  const planType   = autoRenew === 'yes' ? 'eft' : 'otc';
  const status     = mapStatus(row);
  const amountCents = parseMoney(row.AutoPayAmount);
  const startDate   = toISODate(row.StartDate);
  const endDate     = toISODate(row.EndDate);
  const kidId       = mbKidId(row.ClientID);
  const memId       = mbMembershipId(row.ClientID, contractName, row.StartDate);

  membershipRows.push({
    _clientId: row.ClientID,
    _kidId:    kidId,
    id:        memId,
    plan_name: planEntry.plan_name,
    plan_type: planType,
    status,
    amount_cents: amountCents,
    started_at:   startDate,
    cancelled_at: status === 'cancelled' ? (endDate ?? new Date().toISOString()) : null,
  });

  if (status === 'active') report.active++;
  else report.cancelled++;
  report.mapped++;
}

// ── Dry-run report ─────────────────────────────────────────────────────────────
console.log('\n─── Reconciliation Report ───────────────────────────────────────────');
console.log(`  Rows mapped:       ${report.mapped}`);
console.log(`  Rows unmapped:     ${report.unmapped}  (no entry in plan-map.json)`);
console.log(`  → active:          ${report.active}`);
console.log(`  → cancelled:       ${report.cancelled}`);
if (unmappedContracts.size) {
  console.log(`  Unmapped contracts: ${[...unmappedContracts].join(', ')}`);
  console.log(`  Add these to scripts/mindbody-plan-map.json before running live.`);
}

if (DRY_RUN) {
  console.log('\n[DRY-RUN] No database writes performed.');
  console.log('='.repeat(65) + '\n');
  process.exit(0);
}

// ── Resolve tenant ─────────────────────────────────────────────────────────────
const tenants = await restGet(`tenants?slug=eq.${TENANT_SLUG}&select=id,name`);
if (!tenants.length) { console.error(`ERROR: tenant slug '${TENANT_SLUG}' not found.`); process.exit(1); }
const TENANT_ID = tenants[0].id;
console.log(`\nTenant: ${tenants[0].name} (${TENANT_ID})`);

// ── Write memberships ──────────────────────────────────────────────────────────
console.log('\n─── Importing Memberships ───────────────────────────────────────────');

let inserted = 0, skipped = 0;
const errors = [];

for (const mem of membershipRows) {
  const { _clientId, _kidId, ...memRow } = mem;

  // Look up family_id and validate kid exists.
  const kidRows = await restGet(`kids?id=eq.${_kidId}&select=id,family_id`);
  if (!kidRows.length) {
    errors.push(`ClientID ${_clientId}: kid not found (id=${_kidId}). Run clients import first.`);
    skipped++;
    continue;
  }

  memRow.tenant_id = TENANT_ID;
  memRow.family_id = kidRows[0].family_id;
  memRow.kid_id    = _kidId;

  try {
    await restInsert('memberships', memRow);
    inserted++;
    console.log(`  [upsert] ${_clientId} → ${memRow.plan_name} (${memRow.status})`);
  } catch (err) {
    errors.push(`ClientID ${_clientId}: ${err.message}`);
    console.error(`  ERROR: ${_clientId}: ${err.message}`);
  }
}

console.log(`
${'='.repeat(65)}
DONE — MindBody Memberships Import
${'='.repeat(65)}
  Inserted / updated: ${inserted}
  Skipped (no kid):   ${skipped}
  Errors:             ${errors.length}
${'='.repeat(65)}
`);

if (errors.length) {
  errors.forEach(e => console.error(`  • ${e}`));
  process.exit(1);
}
