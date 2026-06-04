#!/usr/bin/env node
// =============================================================================
// scripts/seed-coach-mike-sessions.mjs
// =============================================================================
// Inserts 6 confirmed upcoming bookings for Coach Mike spread across the next
// 15 days, across 3 kids already in the demo data (de00… namespace).
//
// Usage:
//   node scripts/seed-coach-mike-sessions.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Prerequisite:
//   node scripts/provision-coach-mike.mjs   (Coach Mike must exist)
//   node scripts/seed-demo-scenario.mjs     (Marcus + peers must exist)
//
// Idempotent: every INSERT uses ON CONFLICT (id) DO NOTHING.
//
// Cleanup:
//   node scripts/delete-coach-mike-sessions.mjs
//
// ── UUID NAMESPACE ────────────────────────────────────────────────────────────
// All records use the `c0ac` prefix — distinct from de00… and 5eed… namespaces.
//
//   c0ac0006 = bookings  (indices 1–6)
//
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID    = '00000000-0000-0000-0000-000000000001';
const LOCATION_ID  = '00000000-0000-0000-0000-000000000101';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// Deterministic UUID helpers
// =============================================================================

function coachSessionId(index) {
  const i = String(index).padStart(12, '0');
  return `c0ac0006-0000-0000-0000-${i}`;
}

// Kids from seed-demo-scenario.mjs (de00… namespace):
function demoId(table, index) {
  const t = String(table).padStart(4, '0');
  const i = String(index).padStart(12, '0');
  return `de00${t}-0000-0000-0000-${i}`;
}

const MARCUS_KID_ID  = demoId(2, 1);  // Marcus Rivera
const JAYLEN_KID_ID  = demoId(2, 2);  // Jaylen Carter
const SOFIA_KID_ID   = demoId(2, 3);  // Sofia Martinez

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

async function adminRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: baseHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok && res.status !== 404) {
    throw new Error(`${method} /admin/${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function restInsert(table, rows) {
  const body = Array.isArray(rows) ? rows : [rows];
  if (body.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`INSERT ${table} → ${res.status}: ${t}`);
  }
}

// =============================================================================
// Date helpers
// =============================================================================

function daysFromNowAtUTC(days, utcHour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toISOString();
}

function addMinutes(isoString, minutes) {
  return new Date(new Date(isoString).getTime() + minutes * 60_000).toISOString();
}

// =============================================================================
// Step 0 — Look up Coach Mike
// =============================================================================

console.log('\n─── COACH MIKE LOOKUP ────────────────────────────────────────────────');

const COACH_MIKE_EMAIL = 'coach.mike@infinitehitting.com';
const userList = await adminRequest('GET', `users?filter=${encodeURIComponent(COACH_MIKE_EMAIL)}`);
const mikeUser = (userList?.users || []).find(u => u.email === COACH_MIKE_EMAIL);

if (!mikeUser) {
  console.error('\n  ERROR: Coach Mike (coach.mike@infinitehitting.com) is not provisioned.');
  console.error('         Run: node scripts/provision-coach-mike.mjs');
  process.exit(1);
}

const coachRows = await restGet(`coaches?user_id=eq.${mikeUser.id}&tenant_id=eq.${TENANT_ID}&select=id`);
if (!coachRows.length) {
  console.error('\n  ERROR: coaches row not found for Coach Mike.');
  process.exit(1);
}

const coachMikeTableId = coachRows[0].id;
console.log(`  Coach Mike: auth.id=${mikeUser.id}, coaches.id=${coachMikeTableId}`);

// =============================================================================
// Step 1 — Verify kids exist
// =============================================================================

console.log('\n─── VERIFYING DEMO KIDS ──────────────────────────────────────────────');

const kidIds   = [MARCUS_KID_ID, JAYLEN_KID_ID, SOFIA_KID_ID];
const kidNames = ['Marcus Rivera', 'Jaylen Carter', 'Sofia Martinez'];

for (let i = 0; i < kidIds.length; i++) {
  const rows = await restGet(`kids?id=eq.${kidIds[i]}&select=id,first_name,last_name`);
  if (!rows.length) {
    console.error(`  ERROR: Kid ${kidNames[i]} (${kidIds[i]}) not found.`);
    console.error('         Run: node scripts/seed-demo-scenario.mjs');
    process.exit(1);
  }
  console.log(`  ✓ ${rows[0].first_name} ${rows[0].last_name}`);
}

// =============================================================================
// Step 2 — Query session types for this tenant
// =============================================================================

console.log('\n─── SESSION TYPES ────────────────────────────────────────────────────');

const sessionTypes = await restGet(
  `session_types?tenant_id=eq.${TENANT_ID}&is_active=eq.true&select=id,name,type_category,duration_minutes&order=type_category.asc,name.asc`,
);

if (!sessionTypes.length) {
  console.error('  ERROR: No active session_types found for this tenant.');
  console.error('         Ensure migrations have run (v0.3 bookings schema seeds Private/Group/Cage types).');
  process.exit(1);
}

const privateType = sessionTypes.find(s => s.type_category === 'private') ?? sessionTypes[0];
const groupType   = sessionTypes.find(s => s.type_category === 'group')   ?? sessionTypes[0];

console.log(`  Private → "${privateType.name}" (${privateType.duration_minutes} min, id=${privateType.id})`);
console.log(`  Group   → "${groupType.name}" (${groupType.duration_minutes} min, id=${groupType.id})`);

// =============================================================================
// Step 3 — Insert 6 confirmed upcoming bookings
//
// Schedule (days from today, UTC hour, kid, cage, category):
//   +1  → Marcus,  9 AM,  Cage 1, private
//   +3  → Jaylen, 11 AM,  Cage 2, private
//   +5  → Sofia,   2 PM,  Cage 3, private
//   +8  → Marcus,  4 PM,  Cage 1, private
//   +11 → Jaylen,  9 AM,  Cage 2, private
//   +14 → Sofia,  11 AM,  Cage 3, group
// =============================================================================

console.log('\n─── INSERTING BOOKINGS ───────────────────────────────────────────────');

const BOOKING_DEFS = [
  { id: coachSessionId(7), days: 0,  hour: 9,  kid: MARCUS_KID_ID, cage: '1', stType: privateType },
  { id: coachSessionId(1), days: 1,  hour: 9,  kid: MARCUS_KID_ID, cage: '1', stType: privateType },
  { id: coachSessionId(2), days: 3,  hour: 11, kid: JAYLEN_KID_ID, cage: '2', stType: privateType },
  { id: coachSessionId(3), days: 5,  hour: 14, kid: SOFIA_KID_ID,  cage: '3', stType: privateType },
  { id: coachSessionId(4), days: 8,  hour: 16, kid: MARCUS_KID_ID, cage: '1', stType: privateType },
  { id: coachSessionId(5), days: 11, hour: 9,  kid: JAYLEN_KID_ID, cage: '2', stType: privateType },
  { id: coachSessionId(6), days: 14, hour: 11, kid: SOFIA_KID_ID,  cage: '3', stType: groupType   },
];

const bookings = BOOKING_DEFS.map((def) => {
  const start = daysFromNowAtUTC(def.days, def.hour);
  return {
    id:               def.id,
    tenant_id:        TENANT_ID,
    location_id:      LOCATION_ID,
    coach_id:         coachMikeTableId,
    kid_id:           def.kid,
    session_type_id:  def.stType.id,
    scheduled_start:  start,
    scheduled_end:    addMinutes(start, def.stType.duration_minutes),
    cage_number:      def.cage,
    status:           'confirmed',
  };
});

await restInsert('bookings', bookings);

for (const def of BOOKING_DEFS) {
  const kidName = kidNames[kidIds.indexOf(def.kid)];
  const h = def.hour;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const timeStr = `${h12}:00 ${ampm}`;
  console.log(`  [day +${String(def.days).padStart(2)}] ${timeStr.padEnd(9)} Cage ${def.cage}  ${def.stType.name.padEnd(20)}  ${kidName}`);
}

// =============================================================================
// Summary
// =============================================================================

console.log(`
=============================================================================
DONE — Coach Mike sessions seeded
=============================================================================
  7 confirmed bookings (1 today + 6 over the next 15 days).
  Kids: Marcus Rivera, Jaylen Carter, Sofia Martinez.
  UUID namespace: c0ac0006-0000-0000-0000-000000000001 … 000000000007

  Remove with: node scripts/delete-coach-mike-sessions.mjs
=============================================================================
`);
