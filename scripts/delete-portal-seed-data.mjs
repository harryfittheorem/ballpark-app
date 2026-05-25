#!/usr/bin/env node
// =============================================================================
// scripts/delete-portal-seed-data.mjs
// =============================================================================
// Removes every record inserted by scripts/seed-portal-demo-data.mjs,
// targeting records by their deterministic UUIDs.
//
// Usage:
//   node scripts/delete-portal-seed-data.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Safe to run if the seed was never run (all deletes are no-ops when rows
// are absent). Running twice is also a no-op.
//
// Delete order (reverse dependency):
//   orders → points_ledger → bookings → payment_events → memberships
//   → kids → family auth users (cascades families rows)
//   → coach auth users (cascades coaches rows)
//   → products
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID    = '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// Deterministic UUID map — mirrors seed script exactly
// =============================================================================

function seedId(table, idx, seg2 = '0000') {
  return `5eed${String(table).padStart(4, '0')}-${seg2}-0000-0000-${String(idx).padStart(12, '0')}`;
}

const COACH_USER_IDS  = Array.from({ length: 4  }, (_, i) => seedId(1, i + 1));
const FAMILY_USER_IDS = Array.from({ length: 15 }, (_, i) => seedId(2, i + 1));
const KID_IDS         = Array.from({ length: 15 }, (_, i) => seedId(3, i + 1));
const MEMBERSHIP_IDS  = Array.from({ length: 15 }, (_, i) => seedId(4, i + 1));
const PRODUCT_IDS     = Array.from({ length: 5  }, (_, i) => seedId(7, i + 1));
const ORDER_IDS       = Array.from({ length: 5  }, (_, i) => seedId(9, i + 1));

// Payment event IDs: up to 13 per membership (months 0–12), same formula
// as seed script.  We over-enumerate and let missing rows be no-ops.
const PAYMENT_EVENT_IDS = [];
for (let memIdx = 0; memIdx < 15; memIdx++) {
  for (let seq = 1; seq <= 13; seq++) {
    PAYMENT_EVENT_IDS.push(seedId(5, seq, String(memIdx + 1).padStart(4, '0')));
  }
}

// Booking IDs: 20 today + 75 historical = 95 base (IDs 1–95)
// + up to 5 for Coach Mike (IDs 96–100). Over-enumerate; missing rows are no-ops.
const BOOKING_IDS = Array.from({ length: 100 }, (_, i) => seedId(6, i + 1));

// Points ledger IDs: up to (70 session + 1 top-up) per kid = 71 per kid max.
const LEDGER_IDS = [];
for (let kidIdx = 0; kidIdx < 15; kidIdx++) {
  for (let n = 1; n <= 75; n++) {
    LEDGER_IDS.push(seedId(8, n, String(kidIdx + 1).padStart(4, '0')));
  }
}

// =============================================================================
// REST / admin helpers
// =============================================================================

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// Delete a list of rows by their ID field.
// PostgREST accepts `id=in.(uuid1,uuid2,...)` for batch deletes.
// Returns the number of rows actually deleted.
async function deleteByIds(table, ids) {
  if (!ids || ids.length === 0) return 0;

  // PostgREST URL length limit: chunk into groups of 100.
  const CHUNK = 100;
  let total = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=in.(${chunk.join(',')})`,
      {
        method: 'DELETE',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
      },
    );
    const text = await res.text();
    if (!res.ok && res.status !== 404) {
      throw new Error(`DELETE ${table} → ${res.status}: ${text}`);
    }
    let json;
    try { json = JSON.parse(text); } catch { json = []; }
    total += Array.isArray(json) ? json.length : 0;
  }
  return total;
}

// Delete an auth user by their deterministic UUID.
async function deleteAuthUser(id) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: baseHeaders,
  });
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`admin DELETE users/${id} → ${res.status}: ${t}`);
  }
  return res.status !== 404 ? 1 : 0;
}

// =============================================================================
// Delete in reverse dependency order
// =============================================================================

// 1. Orders  (kid_id FK is RESTRICT — must delete before kids)
console.log('\n─── ORDERS ───────────────────────────────────────────────────────────');
const orderDel = await deleteByIds('orders', ORDER_IDS);
console.log(`  orders deleted: ${orderDel}`);

// 2. Points Ledger
console.log('\n─── POINTS LEDGER ────────────────────────────────────────────────────');
const ledgerDel = await deleteByIds('points_ledger', LEDGER_IDS);
console.log(`  points_ledger deleted: ${ledgerDel}`);

// 3. Bookings
console.log('\n─── BOOKINGS ─────────────────────────────────────────────────────────');
const bookingDel = await deleteByIds('bookings', BOOKING_IDS);
console.log(`  bookings deleted: ${bookingDel}`);

// 4. Payment Events
console.log('\n─── PAYMENT EVENTS ───────────────────────────────────────────────────');
const paymentDel = await deleteByIds('payment_events', PAYMENT_EVENT_IDS);
console.log(`  payment_events deleted: ${paymentDel}`);

// 5. Memberships
console.log('\n─── MEMBERSHIPS ──────────────────────────────────────────────────────');
const membershipDel = await deleteByIds('memberships', MEMBERSHIP_IDS);
console.log(`  memberships deleted: ${membershipDel}`);

// 6. Kids  (cascade: personal_bests, sessions, swings, assignments, etc.)
console.log('\n─── KIDS ─────────────────────────────────────────────────────────────');
const kidDel = await deleteByIds('kids', KID_IDS);
console.log(`  kids deleted: ${kidDel}`);

// 7. Family auth users  (ON DELETE CASCADE removes the public.families rows)
console.log('\n─── FAMILY AUTH USERS → families rows ───────────────────────────────');
let familyAuthDel = 0;
for (const uid of FAMILY_USER_IDS) {
  familyAuthDel += await deleteAuthUser(uid);
}
console.log(`  family auth users deleted: ${familyAuthDel}`);

// 8. Coach auth users  (ON DELETE CASCADE removes the public.coaches rows)
console.log('\n─── COACH AUTH USERS → coaches rows ─────────────────────────────────');
let coachAuthDel = 0;
for (const uid of COACH_USER_IDS) {
  coachAuthDel += await deleteAuthUser(uid);
}
console.log(`  coach auth users deleted: ${coachAuthDel}`);

// 9. Products
console.log('\n─── PRODUCTS ─────────────────────────────────────────────────────────');
const productDel = await deleteByIds('products', PRODUCT_IDS);
console.log(`  products deleted: ${productDel}`);

// =============================================================================
// Summary
// =============================================================================

const total = orderDel + ledgerDel + bookingDel + paymentDel + membershipDel
            + kidDel + familyAuthDel + coachAuthDel + productDel;

console.log(`
=============================================================================
DONE — Portal seed data removed
=============================================================================
  Orders:          ${orderDel}
  Points Ledger:   ${ledgerDel}
  Bookings:        ${bookingDel}
  Payment Events:  ${paymentDel}
  Memberships:     ${membershipDel}
  Kids:            ${kidDel}
  Family users:    ${familyAuthDel} auth accounts + cascaded families rows
  Coach users:     ${coachAuthDel} auth accounts + cascaded coaches rows
  Products:        ${productDel}
  ─────────────────────────────
  Total rows:      ${total}
=============================================================================
`);
