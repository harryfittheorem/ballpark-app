#!/usr/bin/env node
// =============================================================================
// scripts/seed-demo-scenario.mjs
// =============================================================================
// Seeds a scripted, CEO-ready demo story centred on Marcus Rivera (age 14).
// Every tab of the mobile app and the operator portal will look alive and
// connected rather than showing randomised test fixtures.
//
// Usage:
//   node scripts/seed-demo-scenario.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Prerequisite:
//   Coach Mike must be provisioned first:
//     node scripts/provision-coach-mike.mjs
//   The script will EXIT with an error if Coach Mike is not found.
//
// Idempotent: every INSERT uses ON CONFLICT (id) DO NOTHING.
// The script also repairs trigger side-effects (see §12) so the final
// DB state is the same every time it is re-run.
//
// Cleanup:
//   node scripts/delete-demo-scenario.mjs
//
// ── UUID NAMESPACE ───────────────────────────────────────────────────────────
// All demo records use the `de00` prefix (valid hex, distinct from the
// `5eed` prefix used by seed-portal-demo-data.mjs).
//
// Scheme:  de00{table:04}-0000-0000-0000-{index:012}
//   de000001 = auth users  (family + demo coaches)
//   de000002 = kids
//   de000003 = memberships
//   de000004 = sessions    (HitTrax-style)
//   de000005 = personal_bests
//   de000006 = bookings
//   de000007 = coach_messages
//   de000008 = assignments
//   de000009 = kid_achievements (deterministic rows only)
//   de000010 = points_ledger
//   de000011 = products
//   de000012 = orders
//   de000013 = videos      (placeholder mux rows for coach_msg + drill)
//
// ── TRIGGER SAFETY ───────────────────────────────────────────────────────────
// Several tables have AFTER INSERT triggers that auto-grant achievements and
// update kids.points_balance. This script is ordered to produce exactly the
// intended final state:
//
//   • points_ledger: ALL entries use reason='manual_adjustment' so the
//     _achievements_after_points_ledger trigger never fires.
//
//   • personal_bests: _achievements_after_personal_bests fires and calls
//     _grant_achievement(kid, 'first_pr'). This is one of the two intended
//     achievements — we let it run.
//
//   • orders: _achievements_after_orders fires and calls
//     _grant_achievement(kid, 'first_reward_redeemed'). We do NOT want this
//     achievement for the demo, so §12 finds and removes it.
//
//   • kid_achievements for first_session_attended: inserted directly with a
//     deterministic ID so no balance side-effect is triggered.
//
//   • coach_messages (video.purpose='coach_message'): trigger checks
//     purpose='parent_to_coach'; ours is 'coach_message' so it returns early.
//
//   • assignments (rating=4, not 5): homework_5_star trigger only fires for
//     rating=5, so no side-effect.
//
//   • Final authoritative patch: kids.points_balance = 847 at the very end.
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID    = '00000000-0000-0000-0000-000000000001';
const LOCATION_ID  = '00000000-0000-0000-0000-000000000101';

// Session type IDs (seeded in migrations):
const ST_PRIVATE_60 = '00000000-0000-0000-0000-000000000302';
const ST_GROUP      = '00000000-0000-0000-0000-000000000303';
const ST_CAGE       = '00000000-0000-0000-0000-000000000304';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// Deterministic UUID helpers
// =============================================================================

function demoId(table, index) {
  const t = String(table).padStart(4, '0');
  const i = String(index).padStart(12, '0');
  return `de00${t}-0000-0000-0000-${i}`;
}

// Auth user IDs:
const MARCUS_FAMILY_USER_ID = demoId(1, 1);
const PEER_FAMILY_USER_IDS  = Array.from({ length: 7 }, (_, i) => demoId(1, i + 2));
const DEMO_COACH_USER_IDS   = [demoId(1, 9), demoId(1, 10)];

// Kid IDs:
const MARCUS_KID_ID = demoId(2, 1);
const PEER_KID_IDS  = Array.from({ length: 7 }, (_, i) => demoId(2, i + 2));

// Other deterministic IDs:
const MARCUS_MEMBERSHIP_ID   = demoId(3, 1);
const PEER_MEMBERSHIP_IDS    = Array.from({ length: 7 }, (_, i) => demoId(3, i + 2));
const SESSION_ID             = demoId(4, 1);
const PERSONAL_BEST_ID       = demoId(5, 1);
const UPCOMING_BOOKING_ID    = demoId(6, 1);
const HIST_BOOKING_IDS       = Array.from({ length: 6  }, (_, i) => demoId(6, i + 2));
const TODAY_BOOKING_IDS      = Array.from({ length: 12 }, (_, i) => demoId(6, i + 10));
const COACH_MSG_ID           = demoId(7, 1);
const PENDING_DRILL_ID       = demoId(8, 1);
const COMPLETED_DRILL_ID     = demoId(8, 2);
// kid_achievements: first_session_attended gets a deterministic ID.
// first_pr is auto-granted by the personal_bests trigger (auto-gen UUID).
const FIRST_SESSION_KID_ACH_ID = demoId(9, 1);
const FIRST_PR_FALLBACK_ID     = demoId(9, 2);  // only if trigger skipped on re-run
const PRODUCT_IDS            = [demoId(11, 1), demoId(11, 2), demoId(11, 3)];
const ORDER_ID               = demoId(12, 1);
// Placeholder videos (fake-but-deterministic Mux IDs):
const COACH_MSG_VIDEO_ID     = demoId(13, 1);
const DRILL_VIDEO_ID         = demoId(13, 2);

// Points ledger IDs for Marcus (manual_adjustment entries only):
const LEDGER_IDS = Array.from({ length: 15 }, (_, i) => demoId(10, i + 1));
// Ledger IDs for leaderboard peers (one entry each):
const PEER_LEDGER_IDS = Array.from({ length: 7 }, (_, i) => demoId(10, i + 21));

// =============================================================================
// REST + Admin helpers
// =============================================================================

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function restInsert(table, rows, conflictMode = 'ignore-duplicates') {
  const body = Array.isArray(rows) ? rows : [rows];
  if (body.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: `return=minimal,resolution=${conflictMode}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`INSERT ${table} → ${res.status}: ${t}`);
  }
}

async function restGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...baseHeaders, Prefer: 'return=representation' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return []; }
}

async function restDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { ...baseHeaders, Prefer: 'return=representation' },
  });
  const text = await res.text();
  if (!res.ok && res.status !== 404) throw new Error(`DELETE ${table} → ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return []; }
}

async function restPatch(table, filter, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH ${table} → ${res.status}: ${t}`);
  }
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

async function ensureAuthUser(id, email, userMeta, emailConfirm = false) {
  const list = await adminRequest('GET', `users?filter=${encodeURIComponent(email)}`);
  const existing = (list?.users || []).find(u => u.email === email);
  if (existing) return { user: existing, created: false };
  const user = await adminRequest('POST', 'users', {
    id,
    email,
    password: `DemoScenario-${id.slice(-8)}-2026!`,
    email_confirm: emailConfirm,
    user_metadata: userMeta,
  });
  return { user, created: true };
}

// =============================================================================
// Date helpers
// =============================================================================

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function todayAtUTC(hour) {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function nextFridayAt(utcHour) {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysUntil = ((5 - dayOfWeek + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntil);
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toISOString();
}

function daysAgoAtUTC(n, hour) {
  const d = new Date(Date.now() - n * 86_400_000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateInDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// =============================================================================
// Step 0 — Require Coach Mike (fail fast if not provisioned)
// =============================================================================

console.log('\n─── COACH MIKE LOOKUP ────────────────────────────────────────────────');

let coachMikeUserId  = null;
let coachMikeTableId = null;

{
  const COACH_MIKE_EMAIL = 'coach.mike@infinitehitting.com';
  const list = await adminRequest('GET', `users?filter=${encodeURIComponent(COACH_MIKE_EMAIL)}`);
  const mikeUser = (list?.users || []).find(u => u.email === COACH_MIKE_EMAIL);

  if (!mikeUser) {
    console.error('\n  ERROR: Coach Mike (coach.mike@infinitehitting.com) is not provisioned.');
    console.error('         This demo scenario requires Coach Mike to be set up first.');
    console.error('         Run: node scripts/provision-coach-mike.mjs');
    console.error('         Then re-run this script.');
    process.exit(1);
  }

  const rows = await restGet(`coaches?user_id=eq.${mikeUser.id}&tenant_id=eq.${TENANT_ID}&select=id`);
  if (!rows.length) {
    console.error('\n  ERROR: Coach Mike auth user exists but no coaches row found.');
    console.error('         The handle_new_user trigger may have failed at provision time.');
    console.error('         Check Supabase logs or re-run provision-coach-mike.mjs.');
    process.exit(1);
  }

  coachMikeUserId  = mikeUser.id;
  coachMikeTableId = rows[0].id;
  console.log(`  Coach Mike: auth.id=${coachMikeUserId}, coaches.id=${coachMikeTableId}`);
}

// =============================================================================
// Step 1 — Demo coaches (Alex + Jordan) for the 12-booking dashboard view
// =============================================================================

console.log('\n─── DEMO COACHES ─────────────────────────────────────────────────────');

const DEMO_COACH_DEFS = [
  { id: DEMO_COACH_USER_IDS[0], email: 'demo.coach.alex@ballpark.test',   first: 'Alex',   last: 'Rivera'  },
  { id: DEMO_COACH_USER_IDS[1], email: 'demo.coach.jordan@ballpark.test', first: 'Jordan', last: 'Walsh'   },
];

const demoCoachTableIds = [];
for (const def of DEMO_COACH_DEFS) {
  const { user, created } = await ensureAuthUser(
    def.id, def.email,
    { tenant_slug: 'infinitehitting', app_role: 'coach', first_name: def.first, last_name: def.last },
    true,
  );
  console.log(`  ${created ? '[new]' : '[skip]'} ${def.first} ${def.last}`);
  const rows = await restGet(`coaches?user_id=eq.${user.id}&tenant_id=eq.${TENANT_ID}&select=id`);
  if (!rows.length) {
    console.error(`  ERROR: coaches row not found for ${def.email}.`);
    process.exit(1);
  }
  demoCoachTableIds.push(rows[0].id);
}

// =============================================================================
// Step 2 — Marcus Rivera: family auth user + kid
// =============================================================================

console.log('\n─── MARCUS RIVERA (HERO) ─────────────────────────────────────────────');

const { user: carlosUser, created: carlosCreated } = await ensureAuthUser(
  MARCUS_FAMILY_USER_ID,
  'demo.carlos.rivera@ballpark.test',
  { tenant_slug: 'infinitehitting', first_name: 'Carlos', last_name: 'Rivera' },
  false,
);
console.log(`  ${carlosCreated ? '[new]' : '[skip]'} Carlos Rivera (parent auth user)`);

const famRows = await restGet(`families?parent_user_id=eq.${carlosUser.id}&tenant_id=eq.${TENANT_ID}&select=id`);
if (!famRows.length) {
  console.error('  ERROR: families row not found. handle_new_user trigger may have failed.');
  process.exit(1);
}
const MARCUS_FAMILY_ID = famRows[0].id;
console.log(`  Marcus family_id: ${MARCUS_FAMILY_ID}`);

await restInsert('kids', {
  id:               MARCUS_KID_ID,
  family_id:        MARCUS_FAMILY_ID,
  first_name:       'Marcus',
  last_name:        'Rivera',
  age_group:        '14U',
  primary_position: 'SS',
  points_balance:   0,
});
console.log('  Marcus Rivera (kid) seeded');

// =============================================================================
// Step 3 — Marcus's membership (active, Private Hitting Lessons)
// =============================================================================

await restInsert('memberships', {
  id:                 MARCUS_MEMBERSHIP_ID,
  tenant_id:          TENANT_ID,
  family_id:          MARCUS_FAMILY_ID,
  kid_id:             MARCUS_KID_ID,
  plan_name:          'Private Hitting Lessons',
  plan_type:          'eft',
  status:             'active',
  amount_cents:       14900,
  started_at:         daysAgo(120),
  billing_anchor_day: 1,
  cancelled_at:       null,
});
console.log('\n─── MEMBERSHIP ───────────────────────────────────────────────────────');
console.log('  Active "Private Hitting Lessons" membership seeded');

// =============================================================================
// Step 4 — Leaderboard peers (7 more kids → Marcus ranks #3 among 8)
//
// Rank 1: Jaylen Carter  – 1240 pts
// Rank 2: Sofia Martinez – 1050 pts
// Rank 3: Marcus Rivera  –  847 pts  ← HERO
// Rank 4: Ethan Williams –  720 pts
// Rank 5: Aria Patel     –  610 pts
// Rank 6: Noah Thompson  –  480 pts
// Rank 7: Emma Garcia    –  350 pts
// Rank 8: Tyler Chen     –  220 pts
// =============================================================================

console.log('\n─── LEADERBOARD PEERS ────────────────────────────────────────────────');

const PEER_DEFS = [
  { pFirst: 'Darius',  pLast: 'Carter',   kFirst: 'Jaylen', kLast: 'Carter',   pts: 1240, email: 'demo.peer.01@ballpark.test' },
  { pFirst: 'Rosa',    pLast: 'Martinez', kFirst: 'Sofia',  kLast: 'Martinez', pts: 1050, email: 'demo.peer.02@ballpark.test' },
  { pFirst: 'David',   pLast: 'Williams', kFirst: 'Ethan',  kLast: 'Williams', pts:  720, email: 'demo.peer.03@ballpark.test' },
  { pFirst: 'Priya',   pLast: 'Patel',    kFirst: 'Aria',   kLast: 'Patel',    pts:  610, email: 'demo.peer.04@ballpark.test' },
  { pFirst: 'Mike',    pLast: 'Thompson', kFirst: 'Noah',   kLast: 'Thompson', pts:  480, email: 'demo.peer.05@ballpark.test' },
  { pFirst: 'Ana',     pLast: 'Garcia',   kFirst: 'Emma',   kLast: 'Garcia',   pts:  350, email: 'demo.peer.06@ballpark.test' },
  { pFirst: 'Wei',     pLast: 'Chen',     kFirst: 'Tyler',  kLast: 'Chen',     pts:  220, email: 'demo.peer.07@ballpark.test' },
];

const peerFamilyIds = [];
for (let i = 0; i < PEER_DEFS.length; i++) {
  const def = PEER_DEFS[i];
  const { user, created } = await ensureAuthUser(
    PEER_FAMILY_USER_IDS[i], def.email,
    { tenant_slug: 'infinitehitting', first_name: def.pFirst, last_name: def.pLast },
    false,
  );
  console.log(`  ${created ? '[new]' : '[skip]'} ${def.kFirst} ${def.kLast} (${def.pts} pts)`);

  const pFamRows = await restGet(`families?parent_user_id=eq.${user.id}&tenant_id=eq.${TENANT_ID}&select=id`);
  if (!pFamRows.length) { console.error(`  ERROR: families row not found for ${def.email}.`); process.exit(1); }
  peerFamilyIds.push(pFamRows[0].id);

  await restInsert('kids', {
    id: PEER_KID_IDS[i], family_id: pFamRows[0].id,
    first_name: def.kFirst, last_name: def.kLast,
    age_group: '12U', primary_position: 'OF', points_balance: 0,
  });
}

await restInsert('memberships', PEER_DEFS.map((_, i) => ({
  id: PEER_MEMBERSHIP_IDS[i], tenant_id: TENANT_ID,
  family_id: peerFamilyIds[i], kid_id: PEER_KID_IDS[i],
  plan_name: 'Group Classes', plan_type: 'eft', status: 'active',
  amount_cents: 7900, started_at: daysAgo(90), billing_anchor_day: 15, cancelled_at: null,
})));

// =============================================================================
// Step 5 — HitTrax session for Marcus (today)
// NOTE: sessions table has no achievement trigger.
// =============================================================================

console.log('\n─── HITTRAX SESSION (TODAY) ──────────────────────────────────────────');

await restInsert('sessions', {
  id:                     SESSION_ID,
  tenant_id:              TENANT_ID,
  kid_id:                 MARCUS_KID_ID,
  capture_source:         'hittrax',
  capture_session_id:     'DEMO-2026-MARCUS-001',
  facility_id:            'IH-CAGE-2',
  started_at:             todayAtUTC(14),
  ended_at:               todayAtUTC(15),
  swing_count:            45,
  best_exit_velocity_mph: 88.4,
  avg_exit_velocity_mph:  72.3,
  max_distance_ft:        382,
  notes:                  '45 swings | Top EV 88.4 mph | Avg launch 12° | 3 HRs | Best session this month',
});
console.log('  HitTrax session seeded (45 swings, 88.4 mph top EV, today)');

// =============================================================================
// Step 6 — Personal best: exit velocity 88.4 mph
//
// TRIGGER: _achievements_after_personal_bests fires → grants first_pr (WANTED).
//   On first run: auto-gen kid_achievements row + auto-gen ledger row + +25 pts.
//   On re-run: ON CONFLICT (id) DO NOTHING skips the insert → no trigger fire.
// =============================================================================

console.log('\n─── PERSONAL BEST ────────────────────────────────────────────────────');

await restInsert('personal_bests', {
  id:          PERSONAL_BEST_ID,
  tenant_id:   TENANT_ID,
  kid_id:      MARCUS_KID_ID,
  metric:      'exit_velocity_mph',
  value:       88.4,
  swing_id:    null,
  achieved_at: todayAtUTC(14),
});
console.log('  Personal best seeded: exit_velocity_mph = 88.4 mph');
console.log('  → Trigger auto-granted "First Personal Best" achievement (+25 pts)');

// =============================================================================
// Step 7 — Placeholder videos (ready status + fake Mux IDs so app renders
//           the coach message card and drill video frame correctly)
//
// The coach message card on HomeScreen renders "processing" unless
// video.status === 'ready' && video.muxPlaybackId is set (HomeScreen line 117).
// We seed placeholder rows that satisfy this check without needing a real upload.
//
// coach_messages trigger: checks purpose='parent_to_coach' → ours is
// 'coach_message' → trigger returns early. No achievement side-effect.
// =============================================================================

console.log('\n─── PLACEHOLDER VIDEOS ───────────────────────────────────────────────');

await restInsert('videos', [
  {
    id:                   COACH_MSG_VIDEO_ID,
    tenant_id:            TENANT_ID,
    uploaded_by_user_id:  coachMikeUserId,
    mux_asset_id:         'demo-asset-coach-msg-2026-01',
    mux_playback_id:      'demo-pb-coach-msg-2026-01',
    duration_seconds:     47,
    status:               'ready',
    purpose:              'coach_message',
    title:                "This week's focus 🎯",
  },
  {
    id:                   DRILL_VIDEO_ID,
    tenant_id:            TENANT_ID,
    uploaded_by_user_id:  coachMikeUserId,
    mux_asset_id:         'demo-asset-drill-2026-01',
    mux_playback_id:      'demo-pb-drill-2026-01',
    duration_seconds:     93,
    status:               'ready',
    purpose:              'drill',
    title:                'Plate Coverage — Low & Away (Demo)',
  },
]);
console.log('  2 placeholder video rows seeded (ready, fake Mux IDs)');
console.log('  coach_message video: "This week\'s focus 🎯" (47s)');
console.log('  drill video: "Plate Coverage — Low & Away (Demo)" (93s)');

// =============================================================================
// Step 8 — Bookings
// =============================================================================

console.log('\n─── BOOKINGS ─────────────────────────────────────────────────────────');

const bookingRows = [];

// 8a. Marcus's upcoming private lesson — this Friday at 8 PM UTC (≈ 4 PM Eastern).
bookingRows.push({
  id:              UPCOMING_BOOKING_ID,
  tenant_id:       TENANT_ID,
  location_id:     LOCATION_ID,
  kid_id:          MARCUS_KID_ID,
  coach_id:        coachMikeTableId,
  session_type_id: ST_PRIVATE_60,
  scheduled_start: nextFridayAt(20),
  scheduled_end:   nextFridayAt(21),
  cage_number:     '2',
  status:          'confirmed',
  attended_at:     null,
});
console.log('  Upcoming lesson: this Friday 4 PM with Coach Mike');

// 8b. Marcus's 6 historical completed sessions (past 6 weeks).
[6, 5, 4, 3, 2, 1].forEach((weeksAgo, idx) => {
  const daysBack = weeksAgo * 7;
  bookingRows.push({
    id:              HIST_BOOKING_IDS[idx],
    tenant_id:       TENANT_ID,
    location_id:     LOCATION_ID,
    kid_id:          MARCUS_KID_ID,
    coach_id:        coachMikeTableId,
    session_type_id: ST_PRIVATE_60,
    scheduled_start: daysAgoAtUTC(daysBack, 20),
    scheduled_end:   daysAgoAtUTC(daysBack, 21),
    cage_number:     '2',
    status:          'completed',
    attended_at:     daysAgoAtUTC(daysBack, 20),
  });
});
console.log('  6 historical completed sessions for Marcus');

// 8c. Today's 12 dashboard bookings: Coach Mike 8 + Demo Coach Alex 2 + Demo Coach Jordan 2.
const todaySlots = [
  // ── Coach Mike (8 slots) ──────────────────────────────────────────────────
  { hour:  9, cage: '1', kidIdx: 0, coachId: coachMikeTableId,    type: ST_PRIVATE_60 },
  { hour: 10, cage: '2', kidIdx: 1, coachId: coachMikeTableId,    type: ST_PRIVATE_60 },
  { hour: 11, cage: '1', kidIdx: 2, coachId: coachMikeTableId,    type: ST_GROUP      },
  { hour: 13, cage: '3', kidIdx: 3, coachId: coachMikeTableId,    type: ST_PRIVATE_60 },
  { hour: 14, cage: '1', kidIdx: 4, coachId: coachMikeTableId,    type: ST_PRIVATE_60 },
  { hour: 15, cage: '2', kidIdx: 5, coachId: coachMikeTableId,    type: ST_GROUP      },
  { hour: 16, cage: '1', kidIdx: 6, coachId: coachMikeTableId,    type: ST_PRIVATE_60 },
  { hour: 17, cage: '3', kidIdx: 7, coachId: coachMikeTableId,    type: ST_PRIVATE_60 },
  // ── Demo Coach Alex (2 cage slots) ───────────────────────────────────────
  { hour: 10, cage: '4', kidIdx: 0, coachId: demoCoachTableIds[0], type: ST_CAGE       },
  { hour: 14, cage: '5', kidIdx: 2, coachId: demoCoachTableIds[0], type: ST_CAGE       },
  // ── Demo Coach Jordan (2 slots) ──────────────────────────────────────────
  { hour: 11, cage: '6', kidIdx: 3, coachId: demoCoachTableIds[1], type: ST_PRIVATE_60 },
  { hour: 15, cage: '6', kidIdx: 5, coachId: demoCoachTableIds[1], type: ST_GROUP      },
];

todaySlots.forEach((slot, idx) => {
  const kidId = PEER_KID_IDS[slot.kidIdx % PEER_KID_IDS.length];
  bookingRows.push({
    id:              TODAY_BOOKING_IDS[idx],
    tenant_id:       TENANT_ID,
    location_id:     LOCATION_ID,
    kid_id:          kidId,
    coach_id:        slot.coachId,
    session_type_id: slot.type,
    scheduled_start: todayAtUTC(slot.hour),
    scheduled_end:   todayAtUTC(slot.hour + 1),
    cage_number:     slot.cage,
    status:          slot.hour < 14 ? 'confirmed' : 'pending',
    attended_at:     null,
  });
});

await restInsert('bookings', bookingRows);
console.log(`  Dashboard: ${todaySlots.length} today's bookings (3 coaches, cages 1–6)`);
console.log(`  Total bookings: ${bookingRows.length}`);

// =============================================================================
// Step 9 — Coach message (Coach Mike → Marcus, with placeholder video)
//
// video_id references a 'coach_message' purpose video → coach_messages trigger
// checks purpose='parent_to_coach' → ours is 'coach_message' → no side-effect.
//
// Note on `label`: the schema constrains label to
// ('game_footage','home_practice','swing_check','question','other') and documents
// it as "parent→coach messages only; NULL on coach→parent rows". This message is
// coach→parent so label=null is correct. The friendly title "This week's focus 🎯"
// is carried by the associated video.title field.
// =============================================================================

console.log('\n─── COACH MESSAGE ────────────────────────────────────────────────────');

await restInsert('coach_messages', {
  id:                   COACH_MSG_ID,
  tenant_id:            TENANT_ID,
  video_id:             COACH_MSG_VIDEO_ID,
  sender_user_id:       coachMikeUserId,
  recipient_family_id:  MARCUS_FAMILY_ID,
  recipient_kid_id:     MARCUS_KID_ID,
  message_text:         "Hey Marcus — great work this week! Your hip rotation is really coming along. Focus on staying through the ball on low-away pitches. Watch the drill I assigned you before Friday. See you then 💪",
  label:                null,    // NULL for coach→parent messages per schema constraint
  sender_display:       null,
  viewed_at:            null,
  created_at:           daysAgo(1),
});
console.log('  Coach message seeded: "This week\'s focus 🎯" — UNREAD on Home tab');
console.log('  (label=null per schema — valid only for parent→coach; title lives on video row)');

// =============================================================================
// Step 10 — Drill assignments
//
// Pending drill: drill_video_id references the placeholder drill video.
// Completed drill: rating=4 (not 5) → homework_5_star trigger does NOT fire.
// =============================================================================

console.log('\n─── DRILL ASSIGNMENTS ────────────────────────────────────────────────');

await restInsert('assignments', {
  id:                        PENDING_DRILL_ID,
  tenant_id:                 TENANT_ID,
  kid_id:                    MARCUS_KID_ID,
  family_id:                 MARCUS_FAMILY_ID,
  coach_user_id:             coachMikeUserId,
  title:                     'Plate Coverage — Low & Away',
  description:               'Focus on driving low-away pitches to the opposite field. Keep your back hip loaded and extend through contact. Complete 3 rounds of 15 dry swings, then 15 tee swings at the low-away corner.',
  drill_video_id:            DRILL_VIDEO_ID,
  duration_estimate_minutes: 20,
  due_date:                  dateInDays(2),
  point_reward:              25,
  status:                    'pending',
  submitted_at:              null,
  reviewed_at:               null,
  rating:                    null,
  feedback:                  null,
  created_at:                daysAgo(3),
});
console.log(`  Pending drill: "Plate Coverage — Low & Away" — due ${dateInDays(2)} (drill video attached)`);

await restInsert('assignments', {
  id:                        COMPLETED_DRILL_ID,
  tenant_id:                 TENANT_ID,
  kid_id:                    MARCUS_KID_ID,
  family_id:                 MARCUS_FAMILY_ID,
  coach_user_id:             coachMikeUserId,
  title:                     'Hip Load & Drive — Power Sequence',
  description:               'Work on your hip load timing. Pause at toe touch, feel the coil, then explode through. Record yourself from the side angle.',
  drill_video_id:            null,
  duration_estimate_minutes: 15,
  due_date:                  new Date(Date.now() - 8 * 86_400_000).toISOString().split('T')[0],
  point_reward:              25,
  status:                    'reviewed',
  submitted_at:              daysAgo(7),
  submitted_video_url:       null,
  reviewed_at:               daysAgo(6),
  rating:                    4,   // 4★ — homework_5_star trigger does NOT fire
  feedback:                  'Great hip rotation — keep driving through the ball. Your load timing is much improved. Work on staying tall through contact next.',
  created_at:                daysAgo(10),
});
console.log('  Completed drill: "Hip Load & Drive" — 4★ reviewed by Coach Mike');

// =============================================================================
// Step 11 — Products (3 store items for the Earn tab)
// =============================================================================

console.log('\n─── PRODUCTS ─────────────────────────────────────────────────────────');

const PRODUCT_DEFS = [
  { id: PRODUCT_IDS[0], name: 'Infinite Hitting T-Shirt',  category: 'apparel',    cost: 200,  inventory: 30,   image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80' },
  { id: PRODUCT_IDS[1], name: 'Batting Gloves',            category: 'gear',       cost: 500,  inventory: 15,   image_url: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400&q=80' },
  { id: PRODUCT_IDS[2], name: 'Private Lesson Credit',     category: 'experience', cost: 750,  inventory: null, image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&q=80' },
];

// ── Live DB patch (run once after seeding if image_url is not yet set) ────────
// UPDATE products SET image_url = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80' WHERE id = 'de000011-0000-0000-0000-000000000001';
// UPDATE products SET image_url = 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400&q=80' WHERE id = 'de000011-0000-0000-0000-000000000002';
// UPDATE products SET image_url = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&q=80' WHERE id = 'de000011-0000-0000-0000-000000000003';

await restInsert('products', PRODUCT_DEFS.map((def, i) => ({
  id: def.id, tenant_id: TENANT_ID, name: def.name, category: def.category,
  points_cost: def.cost, is_redeemable: true, is_purchasable: false,
  is_active: true, sort_order: i + 1, inventory_count: def.inventory ?? null,
  image_url: def.image_url,
})));
console.log('  3 store products: T-Shirt 200 pts | Batting Gloves 500 pts | Lesson Credit 750 pts');

// =============================================================================
// Step 11b — Past order (T-Shirt, 3 weeks ago)
//
// TRIGGER: _achievements_after_orders fires → grants first_reward_redeemed.
//   • Inserts kid_achievements row (auto-gen UUID) — UNWANTED
//   • Writes points_ledger achievement_bonus row (auto-gen UUID)
//   • Updates kids.points_balance += 10
// §12 removes this achievement. The final PATCH corrects the balance to 847.
//
// Idempotency: ON CONFLICT (id) DO NOTHING on the order row → trigger does
// NOT fire again on re-runs. §12 cleanup handles any lingering rows.
// =============================================================================

console.log('\n─── ORDERS ───────────────────────────────────────────────────────────');

await restInsert('orders', {
  id:                 ORDER_ID,
  tenant_id:          TENANT_ID,
  family_id:          MARCUS_FAMILY_ID,
  kid_id:             MARCUS_KID_ID,
  product_id:         PRODUCT_IDS[0],
  payment_method:     'points',
  amount_paid_points: 200,
  status:             'fulfilled',
  redemption_code:    'DEMO0001',
  created_at:         daysAgo(21),
  fulfilled_at:       daysAgo(20),
});
console.log('  1 past order: Infinite Hitting T-Shirt (200 pts) — fulfilled 3 weeks ago');
console.log('  → Trigger auto-granted "First Reward" achievement — will be removed in §12');

// =============================================================================
// Step 11c — Points ledger (manual_adjustment only — trigger-safe)
//
// All entries use reason='manual_adjustment'. The trigger only acts on
// session_attended / pr_hit / redemption / assignment_completed → no fire.
// =============================================================================

console.log('\n─── POINTS LEDGER ────────────────────────────────────────────────────');

let runningBalance = 0;
let ledgerIdx = 0;
const ledgerRows = [];

function addLedger(delta, note, createdAt) {
  runningBalance += delta;
  ledgerRows.push({
    id:             LEDGER_IDS[ledgerIdx++],
    tenant_id:      TENANT_ID,
    kid_id:         MARCUS_KID_ID,
    delta,
    reason:         'manual_adjustment',
    reference_type: 'manual',
    reference_id:   null,
    balance_after:  runningBalance,
    note,
    created_at:     createdAt,
  });
}

// Session history (6 completed sessions):
[6, 5, 4, 3, 2, 1].forEach(w => {
  addLedger(10, `Session completed (${w === 1 ? 'last week' : w + ' weeks ago'})`, daysAgoAtUTC(w * 7, 21));
});

// Completed assignment:
addLedger(25, 'Drill completed: Hip Load & Drive', daysAgo(7));

// Season / hard work top-up:
addLedger(812, 'Season points — hard work all spring', daysAgo(2));

// T-Shirt redemption (recorded in ledger history):
addLedger(-200, 'Redeemed: Infinite Hitting T-Shirt', daysAgo(21));

if (ledgerIdx > LEDGER_IDS.length) {
  throw new Error(`Ledger overflow: used ${ledgerIdx} IDs, have ${LEDGER_IDS.length}`);
}

await restInsert('points_ledger', ledgerRows);
console.log(`  ${ledgerRows.length} ledger entries for Marcus (manual_adjustment — trigger-safe)`);

// Peer leaderboard entries (one per kid):
const peerLedgerRows = PEER_DEFS.map((def, i) => ({
  id: PEER_LEDGER_IDS[i], tenant_id: TENANT_ID, kid_id: PEER_KID_IDS[i],
  delta: def.pts, reason: 'manual_adjustment', reference_type: 'manual', reference_id: null,
  balance_after: def.pts, note: 'Demo scenario: leaderboard seeding', created_at: daysAgo(1),
}));
await restInsert('points_ledger', peerLedgerRows);
console.log(`  ${peerLedgerRows.length} peer ledger entries seeded`);

for (let i = 0; i < PEER_DEFS.length; i++) {
  await restPatch('kids', `id=eq.${PEER_KID_IDS[i]}`, { points_balance: PEER_DEFS[i].pts });
}
console.log('  Peer kids.points_balance updated');

// =============================================================================
// Step 12 — Achievements + Cleanup Pass
//
// a) Grant first_session_attended directly (deterministic ID, no balance effect).
// b) Verify first_pr was granted by the personal_bests trigger; grant directly
//    as a fallback if personal_bests was already in DB before this run (trigger
//    skipped due to ON CONFLICT DO NOTHING on personal_bests).
// c) Remove the unwanted first_reward_redeemed achievement (granted by orders
//    trigger) and its points_ledger achievement_bonus entry.
// d) Final authoritative PATCH: kids.points_balance = 847.
// =============================================================================

console.log('\n─── ACHIEVEMENTS + CLEANUP PASS ──────────────────────────────────────');

// Look up catalog achievement IDs:
const achRows = await restGet(
  `achievements?key=in.(first_session_attended,first_pr,first_reward_redeemed)&select=id,key,name,points_bonus`,
);
const achMap = Object.fromEntries(achRows.map(a => [a.key, a]));

// a) Grant first_session_attended with a deterministic ID (bypasses
//    _grant_achievement → no balance update, no auto-gen ledger entry).
if (achMap.first_session_attended) {
  await restInsert('kid_achievements', {
    id:             FIRST_SESSION_KID_ACH_ID,
    tenant_id:      TENANT_ID,
    kid_id:         MARCUS_KID_ID,
    achievement_id: achMap.first_session_attended.id,
    earned_at:      daysAgo(45),
  });
  console.log(`  Granted (direct): "${achMap.first_session_attended.name}" — deterministic ID`);
} else {
  console.warn('  WARN: first_session_attended not found in catalog — run migrations first');
}

// b) Verify first_pr (should have been granted by personal_bests trigger).
if (achMap.first_pr) {
  const existing = await restGet(
    `kid_achievements?kid_id=eq.${MARCUS_KID_ID}&achievement_id=eq.${achMap.first_pr.id}&select=id`,
  );
  if (existing.length) {
    console.log(`  Confirmed: "${achMap.first_pr.name}" already granted (trigger-granted)`);
  } else {
    // personal_bests row was already in DB from a prior run → trigger skipped.
    // Grant directly as fallback.
    await restInsert('kid_achievements', {
      id:             FIRST_PR_FALLBACK_ID,
      tenant_id:      TENANT_ID,
      kid_id:         MARCUS_KID_ID,
      achievement_id: achMap.first_pr.id,
      earned_at:      todayAtUTC(14),
    });
    console.log(`  Granted (fallback direct): "${achMap.first_pr.name}"`);
  }
}

// c) Remove the unwanted first_reward_redeemed achievement and its ledger entry.
if (achMap.first_reward_redeemed) {
  const unwanted = await restGet(
    `kid_achievements?kid_id=eq.${MARCUS_KID_ID}&achievement_id=eq.${achMap.first_reward_redeemed.id}&select=id`,
  );
  if (unwanted.length) {
    const kaId = unwanted[0].id;
    const deletedLedger = await restDelete(
      'points_ledger',
      `kid_id=eq.${MARCUS_KID_ID}&reason=eq.achievement_bonus&reference_type=eq.achievement&reference_id=eq.${kaId}`,
    );
    await restDelete('kid_achievements', `id=eq.${kaId}`);
    console.log(`  Removed unwanted "First Reward" achievement + ${deletedLedger.length} bonus ledger row`);
  } else {
    console.log('  "First Reward" achievement not present (already removed or order trigger skipped)');
  }
}

// d) Final authoritative balance patch — overrides any trigger-driven changes.
await restPatch('kids', `id=eq.${MARCUS_KID_ID}`, { points_balance: 847 });
console.log('  Final balance patch: Marcus Rivera = 847 pts (rank #3)');

// Verify final state:
const finalAchs = await restGet(
  `kid_achievements?kid_id=eq.${MARCUS_KID_ID}&select=achievement_id`,
);
console.log(`  Marcus achievements: ${finalAchs.length} (expected: 2)`);
if (finalAchs.length !== 2) {
  console.warn(`  WARN: Expected 2 achievements but found ${finalAchs.length}.`);
  console.warn('        Run scripts/delete-demo-scenario.mjs then re-seed to reset.');
}

// =============================================================================
// Done
// =============================================================================

console.log(`
=============================================================================
DONE — CEO Demo Scenario seeded for Infinite Hitting
=============================================================================
  Hero Athlete:    Marcus Rivera (14U / SS) — 847 pts, rank #3
  Leaderboard:     8 kids (Jaylen 1240 → Tyler 220)
  Membership:      Active "Private Hitting Lessons"
  HitTrax session: Today — 45 swings, 88.4 mph top EV, avg launch 12°
  Personal Best:   exit_velocity_mph = 88.4 mph (Profile PRs grid)
  Upcoming lesson: This Friday 4:00 PM with Coach Mike (cage 2)
  Past bookings:   6 completed sessions (past 6 weeks)
  Dashboard:       12 today's bookings (Coach Mike 8, Alex 2, Jordan 2)
  Coach message:   "This week's focus 🎯" — UNREAD, video READY on Home tab
  Pending drill:   "Plate Coverage — Low & Away" — due in 2 days + drill video
  Reviewed drill:  "Hip Load & Drive" — 4★ Coach Mike feedback
  Achievements:    First Session + First Personal Best (exactly 2)
  Products:        T-Shirt 200 | Batting Gloves 500 | Lesson Credit 750
  Orders:          1 fulfilled (T-Shirt, 3 weeks ago)

  All records use deterministic UUIDs (de00… namespace).
  Distinct from seed-portal-demo-data.mjs (5eed… namespace) — safe to combine.

  Cleanup: node scripts/delete-demo-scenario.mjs
=============================================================================
`);
