#!/usr/bin/env node
// =============================================================================
// scripts/import-mindbody-visits.mjs
// =============================================================================
// Imports MindBody "Visits" CSV export into Ballpark bookings table as
// historical completed sessions.
//
// CSV columns (standard MindBody export):
//   ClientID, VisitDate, ServiceName, StaffName, LocationName, Status
//
// Mapping rules:
//   - Only rows with Status=Completed are imported.
//   - StaffName matched to coaches by first+last name (case-insensitive).
//     Unmatched staff → optional override map via --coach-map JSON file.
//     Visits with no matched coach are skipped (reported).
//   - ServiceName is matched to session_types by name (partial, case-insensitive).
//     Fallback: first active session_type for the tenant.
//   - booking.status = 'completed', attended_at = VisitDate noon UTC
//   - Booking UUID = UUID v5(MB_NS, "booking:{clientId}:{visitDate}:{serviceName}")
//
// Usage:
//   node scripts/import-mindbody-visits.mjs \
//     --input scripts/fixtures/mindbody-visits-sample.csv \
//     [--coach-map scripts/mindbody-coach-map.json] \
//     [--dry-run] \
//     [--tenant-slug infinitehitting]
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { createHash }      from 'crypto';
import { createReadStream } from 'fs';
import { createInterface }  from 'readline';
import { readFile }         from 'fs/promises';
import { existsSync }       from 'fs';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MB_NS        = '00000000-0000-5000-8000-6d696e64626f';

// =============================================================================
// Args
// =============================================================================

const args          = process.argv.slice(2);
const DRY_RUN       = args.includes('--dry-run');
const inputIdx      = args.indexOf('--input');
const INPUT         = inputIdx !== -1 ? args[inputIdx + 1] : null;
const coachMapIdx   = args.indexOf('--coach-map');
const COACH_MAP_PATH = coachMapIdx !== -1 ? args[coachMapIdx + 1] : null;
const slugIdx       = args.indexOf('--tenant-slug');
const TENANT_SLUG   = slugIdx !== -1 ? args[slugIdx + 1] : (process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'infinitehitting');

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

function mbKidId(clientId)     { return uuidV5(MB_NS, `kid:${clientId}`); }
function mbBookingId(clientId, visitDate, serviceName) {
  return uuidV5(MB_NS, `booking:${clientId}:${visitDate}:${serviceName}`);
}
function mbSessionId(clientId, visitDate, serviceName) {
  return uuidV5(MB_NS, `session:${clientId}:${visitDate}:${serviceName}`);
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
// Name matching helpers
// =============================================================================

function normalizeName(name) {
  return (name ?? '').toLowerCase().replace(/[^a-z ]/g, '').trim();
}

function matchCoach(staffName, coaches) {
  const target = normalizeName(staffName);
  return coaches.find(c => {
    const full = normalizeName(`${c.first_name} ${c.last_name}`);
    return full === target || full.includes(target) || target.includes(full);
  }) ?? null;
}

function matchSessionType(serviceName, sessionTypes, fallback) {
  const target = normalizeName(serviceName);
  return sessionTypes.find(st => {
    const name = normalizeName(st.name);
    return name === target || name.includes(target) || target.includes(name);
  }) ?? fallback ?? null;
}

// =============================================================================
// Main
// =============================================================================

console.log(`\n${'='.repeat(65)}`);
console.log('MindBody Visits Import' + (DRY_RUN ? '  [DRY-RUN]' : ''));
console.log('='.repeat(65));
console.log(`Input: ${INPUT}`);

// Load optional coach override map: { "Staff Name": "coachId" }
let coachOverrideMap = {};
if (COACH_MAP_PATH && existsSync(COACH_MAP_PATH)) {
  coachOverrideMap = JSON.parse(await readFile(COACH_MAP_PATH, 'utf8'));
  console.log(`Coach override map loaded: ${Object.keys(coachOverrideMap).length} entries`);
}

const rows = await parseCSV(INPUT);
console.log(`Rows read: ${rows.length}`);

const completedRows = rows.filter(r => (r.Status ?? '').toLowerCase() === 'completed');
const skippedStatus = rows.length - completedRows.length;
console.log(`Completed: ${completedRows.length}  |  Skipped (non-completed): ${skippedStatus}`);

// ── Reconciliation report (dry-run can still show stats) ──────────────────────
const staffNames = new Set(completedRows.map(r => r.StaffName));
const services   = new Set(completedRows.map(r => r.ServiceName));
const clientIds  = new Set(completedRows.map(r => r.ClientID));

console.log('\n─── Reconciliation Report ───────────────────────────────────────────');
console.log(`  Completed visits:    ${completedRows.length}`);
console.log(`  Unique clients:      ${clientIds.size}`);
console.log(`  Unique staff names:  ${staffNames.size} → ${[...staffNames].join(', ')}`);
console.log(`  Unique services:     ${services.size} → ${[...services].join(', ')}`);

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

// ── Load coaches + session_types + location ────────────────────────────────────
const coaches      = await restGet(`coaches?tenant_id=eq.${TENANT_ID}&select=id,first_name,last_name`);
const sessionTypes = await restGet(`session_types?tenant_id=eq.${TENANT_ID}&is_active=eq.true&select=id,name,type_category,duration_minutes`);
const locations    = await restGet(`locations?tenant_id=eq.${TENANT_ID}&select=id,name&limit=1`);

if (!locations.length) { console.error('ERROR: no locations found for tenant.'); process.exit(1); }
const LOCATION_ID = locations[0].id;

const fallbackSessionType = sessionTypes[0] ?? null;
console.log(`\nCoaches loaded:       ${coaches.length}`);
console.log(`Session types loaded: ${sessionTypes.length}`);
console.log(`Using location:       ${locations[0].name} (${LOCATION_ID})`);
if (!fallbackSessionType) { console.error('ERROR: no session types found. Cannot create bookings.'); process.exit(1); }

// ── Import bookings ────────────────────────────────────────────────────────────
console.log('\n─── Importing Visits → Bookings ─────────────────────────────────────');

let inserted = 0, errCount = 0;
const noCoachRows = [];
const noKidRows   = [];

for (const row of completedRows) {
  const clientId   = row.ClientID;
  const kidId      = mbKidId(clientId);
  const bookingId  = mbBookingId(clientId, row.VisitDate, row.ServiceName);

  // Validate kid exists.
  const kidRows = await restGet(`kids?id=eq.${kidId}&select=id,family_id`);
  if (!kidRows.length) {
    noKidRows.push(clientId);
    continue;
  }

  // Resolve coach.
  let coach = null;
  if (coachOverrideMap[row.StaffName]) {
    coach = { id: coachOverrideMap[row.StaffName] };
  } else {
    coach = matchCoach(row.StaffName, coaches);
  }
  if (!coach) {
    noCoachRows.push(`${clientId} (staff: "${row.StaffName}")`);
    continue;
  }

  // Resolve session type.
  const sessionType = matchSessionType(row.ServiceName, sessionTypes, fallbackSessionType);

  // Build timestamps: visitDate at noon UTC, 1-hour duration.
  const startDt = new Date(`${row.VisitDate}T12:00:00Z`);
  const endDt   = new Date(startDt.getTime() + (sessionType.duration_minutes ?? 60) * 60_000);

  const bookingRow = {
    id:              bookingId,
    tenant_id:       TENANT_ID,
    location_id:     LOCATION_ID,
    kid_id:          kidId,
    coach_id:        coach.id,
    session_type_id: sessionType.id,
    scheduled_start: startDt.toISOString(),
    scheduled_end:   endDt.toISOString(),
    status:          'completed',
    attended_at:     endDt.toISOString(),
    notes:           `Imported from MindBody. Service: ${row.ServiceName}`,
  };

  // Corresponding performance session row (capture_source='manual').
  // Idempotency: unique on (capture_source, capture_session_id) via partial index.
  const sessionId  = mbSessionId(clientId, row.VisitDate, row.ServiceName);
  const sessionRow = {
    id:              sessionId,
    tenant_id:       TENANT_ID,
    kid_id:          kidId,
    capture_source:  'manual',
    capture_session_id: sessionId, // use our deterministic ID as the dedupe key
    started_at:      startDt.toISOString(),
    ended_at:        endDt.toISOString(),
    notes:           `MindBody import: ${row.ServiceName} (${row.StaffName})`,
  };

  try {
    await restInsert('bookings', bookingRow);
    await restInsert('sessions', sessionRow);
    inserted++;
    console.log(`  [upsert] ${clientId} ${row.VisitDate} "${row.ServiceName}" w/ ${row.StaffName}`);
  } catch (err) {
    errCount++;
    console.error(`  ERROR: ${clientId} ${row.VisitDate}: ${err.message}`);
  }
}

if (noKidRows.length) {
  console.warn(`\n  WARN: ${noKidRows.length} visits skipped — kid not found (run clients import first):`);
  noKidRows.forEach(id => console.warn(`    ClientID ${id}`));
}
if (noCoachRows.length) {
  console.warn(`\n  WARN: ${noCoachRows.length} visits skipped — staff not matched to a coach:`);
  noCoachRows.forEach(r => console.warn(`    ${r}`));
  console.warn(`  Tip: create a --coach-map JSON file mapping staff names to coach UUIDs.`);
}

console.log(`
${'='.repeat(65)}
DONE — MindBody Visits Import
${'='.repeat(65)}
  Bookings inserted:        ${inserted}
  Skipped (non-completed):  ${skippedStatus}
  Skipped (no kid found):   ${noKidRows.length}
  Skipped (no coach match): ${noCoachRows.length}
  Errors:                   ${errCount}
${'='.repeat(65)}
`);

if (errCount > 0) process.exit(1);
