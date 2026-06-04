#!/usr/bin/env node
// =============================================================================
// scripts/delete-coach-mike-sessions.mjs
// =============================================================================
// Removes every booking inserted by scripts/seed-coach-mike-sessions.mjs.
//
// Usage:
//   node scripts/delete-coach-mike-sessions.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Safe to run when seed was never run (all deletes are no-ops).
// Running twice is also a no-op.
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// Deterministic UUIDs — mirrors seed-coach-mike-sessions.mjs exactly
// =============================================================================

function coachSessionId(index) {
  const i = String(index).padStart(12, '0');
  return `c0ac0006-0000-0000-0000-${i}`;
}

const ALL_BOOKING_IDS = Array.from({ length: 6 }, (_, i) => coachSessionId(i + 1));

// =============================================================================
// REST helpers
// =============================================================================

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function deleteByIds(table, ids) {
  if (!ids || ids.length === 0) return 0;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=in.(${ids.join(',')})`,
    { method: 'DELETE', headers: { ...baseHeaders, Prefer: 'return=representation' } },
  );
  const text = await res.text();
  if (!res.ok && res.status !== 404) throw new Error(`DELETE ${table} → ${res.status}: ${text}`);
  let json; try { json = JSON.parse(text); } catch { json = []; }
  return Array.isArray(json) ? json.length : 0;
}

// =============================================================================
// Delete
// =============================================================================

console.log('\n─── BOOKINGS ─────────────────────────────────────────────────────────');
const bookingDel = await deleteByIds('bookings', ALL_BOOKING_IDS);
console.log(`  bookings deleted: ${bookingDel}`);

console.log(`
=============================================================================
DONE — Coach Mike sessions removed
=============================================================================
  Bookings deleted: ${bookingDel}
  (UUIDs c0ac0006-0000-0000-0000-000000000001 … 000000000006)
=============================================================================
`);
