#!/usr/bin/env node
// =============================================================================
// scripts/delete-demo-scenario.mjs
// =============================================================================
// Removes every record inserted by scripts/seed-demo-scenario.mjs,
// including trigger-generated rows (achievement bonus ledger entries and
// kid_achievements rows with auto-generated UUIDs).
//
// Usage:
//   node scripts/delete-demo-scenario.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Safe to run when seed was never run (all deletes are no-ops).
// Running twice is also a no-op.
//
// Delete order (reverse FK dependency):
//   orders
//   → kid_achievements (ALL for Marcus, including trigger-generated rows)
//   → points_ledger achievement_bonus entries (trigger-generated, non-deterministic)
//   → points_ledger deterministic entries (de00… IDs)
//   → assignments
//   → coach_messages
//   → videos (placeholder rows seeded for coach_msg + drill)
//   → bookings → sessions → personal_bests
//   → memberships → kids → products
//   → family/peer auth users (cascade-deletes families rows)
//   → demo coach auth users (cascade-deletes coaches rows)
//
// NOTE: Coach Mike is NOT deleted — he was provisioned separately via
// provision-coach-mike.mjs.
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID    = '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// Deterministic UUIDs — mirrors seed-demo-scenario.mjs exactly
// =============================================================================

function demoId(table, index) {
  const t = String(table).padStart(4, '0');
  const i = String(index).padStart(12, '0');
  return `de00${t}-0000-0000-0000-${i}`;
}

const MARCUS_FAMILY_USER_ID = demoId(1, 1);
const PEER_FAMILY_USER_IDS  = Array.from({ length: 7 }, (_, i) => demoId(1, i + 2));
const DEMO_COACH_USER_IDS   = [demoId(1, 9), demoId(1, 10)];

const MARCUS_KID_ID = demoId(2, 1);
const PEER_KID_IDS  = Array.from({ length: 7 }, (_, i) => demoId(2, i + 2));
const ALL_KID_IDS   = [MARCUS_KID_ID, ...PEER_KID_IDS];

const ALL_MEMBERSHIP_IDS = [
  demoId(3, 1),
  ...Array.from({ length: 7 }, (_, i) => demoId(3, i + 2)),
];

const SESSION_ID       = demoId(4, 1);
const PERSONAL_BEST_ID = demoId(5, 1);

// Bookings: 1 upcoming + 6 historical + 12 dashboard = 19 total
const ALL_BOOKING_IDS = [
  demoId(6, 1),
  ...Array.from({ length: 6  }, (_, i) => demoId(6, i + 2)),
  ...Array.from({ length: 12 }, (_, i) => demoId(6, i + 10)),
];

const COACH_MSG_ID       = demoId(7, 1);
const ALL_ASSIGNMENT_IDS = [demoId(8, 1), demoId(8, 2)];

// Deterministic kid_achievement IDs (direct inserts by seed script):
const DETERMINISTIC_KID_ACH_IDS = [
  demoId(9, 1),  // first_session_attended (direct insert)
  demoId(9, 2),  // first_pr fallback (only on re-runs where trigger skipped)
];

// Deterministic ledger IDs (manual_adjustment entries only):
const DETERMINISTIC_LEDGER_IDS = [
  ...Array.from({ length: 15 }, (_, i) => demoId(10, i + 1)),
  ...Array.from({ length: 7  }, (_, i) => demoId(10, i + 21)),
];

const ALL_PRODUCT_IDS = [demoId(11, 1), demoId(11, 2), demoId(11, 3)];
const ORDER_ID        = demoId(12, 1);
const ALL_VIDEO_IDS   = [demoId(13, 1), demoId(13, 2)];

// =============================================================================
// REST / admin helpers
// =============================================================================

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function deleteByIds(table, ids) {
  if (!ids || ids.length === 0) return 0;
  const CHUNK = 100;
  let total = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=in.(${chunk.join(',')})`,
      { method: 'DELETE', headers: { ...baseHeaders, Prefer: 'return=representation' } },
    );
    const text = await res.text();
    if (!res.ok && res.status !== 404) throw new Error(`DELETE ${table} → ${res.status}: ${text}`);
    let json; try { json = JSON.parse(text); } catch { json = []; }
    total += Array.isArray(json) ? json.length : 0;
  }
  return total;
}

async function deleteByFilter(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { ...baseHeaders, Prefer: 'return=representation' },
  });
  const text = await res.text();
  if (!res.ok && res.status !== 404) throw new Error(`DELETE ${table} (filter) → ${res.status}: ${text}`);
  let json; try { json = JSON.parse(text); } catch { json = []; }
  return Array.isArray(json) ? json.length : 0;
}

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

// 1. Orders (FK RESTRICT on orders.kid_id — must delete before kids)
console.log('\n─── ORDERS ───────────────────────────────────────────────────────────');
const orderDel = await deleteByIds('orders', [ORDER_ID]);
console.log(`  orders deleted: ${orderDel}`);

// 2. kid_achievements — delete ALL for Marcus (covers deterministic IDs AND
//    any trigger-generated rows with auto-gen UUIDs from personal_bests /
//    orders triggers).
//    For peers, delete only deterministic IDs (peers never triggered achievements).
console.log('\n─── KID ACHIEVEMENTS ─────────────────────────────────────────────────');
const marcusAchDel = await deleteByFilter('kid_achievements', `kid_id=eq.${MARCUS_KID_ID}`);
const peerAchDel   = await deleteByIds('kid_achievements', DETERMINISTIC_KID_ACH_IDS);
console.log(`  kid_achievements: ${marcusAchDel} (Marcus, all) + ${peerAchDel} (peer deterministic)`);

// 3a. Trigger-generated achievement_bonus ledger entries for Marcus (auto-gen IDs).
// 3b. Deterministic manual_adjustment ledger entries (de00… IDs).
console.log('\n─── POINTS LEDGER ────────────────────────────────────────────────────');
const achBonusDel         = await deleteByFilter('points_ledger', `kid_id=eq.${MARCUS_KID_ID}&reason=eq.achievement_bonus`);
const deterministicLedger = await deleteByIds('points_ledger', DETERMINISTIC_LEDGER_IDS);
console.log(`  points_ledger: ${achBonusDel} achievement_bonus (trigger) + ${deterministicLedger} manual (deterministic)`);

// 4. Assignments (drill_video_id → ON DELETE SET NULL on videos, so safe to do before or after videos)
console.log('\n─── ASSIGNMENTS ──────────────────────────────────────────────────────');
const assignDel = await deleteByIds('assignments', ALL_ASSIGNMENT_IDS);
console.log(`  assignments deleted: ${assignDel}`);

// 5. Coach messages (video_id → ON DELETE CASCADE from videos; delete messages
//    first so we control the deletion explicitly rather than letting cascade run)
console.log('\n─── COACH MESSAGES ───────────────────────────────────────────────────');
const msgDel = await deleteByIds('coach_messages', [COACH_MSG_ID]);
console.log(`  coach_messages deleted: ${msgDel}`);

// 6. Videos (placeholder rows seeded for coach_msg + drill)
console.log('\n─── VIDEOS ───────────────────────────────────────────────────────────');
const videoDel = await deleteByIds('videos', ALL_VIDEO_IDS);
console.log(`  videos deleted: ${videoDel}`);

// 7. Bookings
console.log('\n─── BOOKINGS ─────────────────────────────────────────────────────────');
const bookingDel = await deleteByIds('bookings', ALL_BOOKING_IDS);
console.log(`  bookings deleted: ${bookingDel}`);

// 8. Sessions (HitTrax)
console.log('\n─── SESSIONS ─────────────────────────────────────────────────────────');
const sessionDel = await deleteByIds('sessions', [SESSION_ID]);
console.log(`  sessions deleted: ${sessionDel}`);

// 9. Personal bests
console.log('\n─── PERSONAL BESTS ───────────────────────────────────────────────────');
const prDel = await deleteByIds('personal_bests', [PERSONAL_BEST_ID]);
console.log(`  personal_bests deleted: ${prDel}`);

// 10. Memberships
console.log('\n─── MEMBERSHIPS ──────────────────────────────────────────────────────');
const membershipDel = await deleteByIds('memberships', ALL_MEMBERSHIP_IDS);
console.log(`  memberships deleted: ${membershipDel}`);

// 11. Kids
console.log('\n─── KIDS ─────────────────────────────────────────────────────────────');
const kidDel = await deleteByIds('kids', ALL_KID_IDS);
console.log(`  kids deleted: ${kidDel}`);

// 12. Products
console.log('\n─── PRODUCTS ─────────────────────────────────────────────────────────');
const productDel = await deleteByIds('products', ALL_PRODUCT_IDS);
console.log(`  products deleted: ${productDel}`);

// 13. Family + peer auth users (ON DELETE CASCADE removes public.families rows)
console.log('\n─── FAMILY AUTH USERS → families rows ───────────────────────────────');
const allFamilyUserIds = [MARCUS_FAMILY_USER_ID, ...PEER_FAMILY_USER_IDS];
let familyAuthDel = 0;
for (const uid of allFamilyUserIds) { familyAuthDel += await deleteAuthUser(uid); }
console.log(`  family auth users deleted: ${familyAuthDel}`);

// 14. Demo coach auth users (ON DELETE CASCADE removes public.coaches rows)
console.log('\n─── DEMO COACH AUTH USERS → coaches rows ────────────────────────────');
let coachAuthDel = 0;
for (const uid of DEMO_COACH_USER_IDS) { coachAuthDel += await deleteAuthUser(uid); }
console.log(`  demo coach auth users deleted: ${coachAuthDel}`);

// =============================================================================
// Summary
// =============================================================================

const total = orderDel + marcusAchDel + peerAchDel + achBonusDel + deterministicLedger
            + assignDel + msgDel + videoDel + bookingDel + sessionDel + prDel
            + membershipDel + kidDel + productDel + familyAuthDel + coachAuthDel;

console.log(`
=============================================================================
DONE — CEO Demo Scenario removed
=============================================================================
  Orders:                ${orderDel}
  Kid achievements:      ${marcusAchDel} (Marcus all) + ${peerAchDel} (peer deterministic)
  Ledger (trigger):      ${achBonusDel} achievement_bonus rows (auto-gen)
  Ledger (deterministic):${deterministicLedger} manual_adjustment rows
  Assignments:           ${assignDel}
  Coach messages:        ${msgDel}
  Videos:                ${videoDel} (placeholder rows)
  Bookings:              ${bookingDel}
  Sessions:              ${sessionDel}
  Personal bests:        ${prDel}
  Memberships:           ${membershipDel}
  Kids:                  ${kidDel}
  Products:              ${productDel}
  Family users:          ${familyAuthDel} auth accounts + cascaded families rows
  Demo coaches:          ${coachAuthDel} auth accounts + cascaded coaches rows
  ──────────────────────────────────────
  Total rows:            ${total}

  NOTE: Coach Mike is NOT deleted (provisioned separately).
=============================================================================
`);
