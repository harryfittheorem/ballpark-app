#!/usr/bin/env node
// =============================================================================
// scripts/seed-portal-demo-data.mjs
// =============================================================================
// Seeds realistic demo data for the owner portal so every page (Dashboard,
// Members CRM, Schedule, Coaches, Billing, Failed Payments, Revenue Reports,
// MIA, At-Risk, Points & Rewards) shows populated charts and clickable rows.
//
// Usage:
//   node scripts/seed-portal-demo-data.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent: every insert uses ON CONFLICT (id) DO NOTHING so re-running
// is a complete no-op.
//
// Cleanup (removes every seeded record by its deterministic ID):
//   node scripts/delete-portal-seed-data.mjs
//
// ── NOTE ON AUTH USERS ──────────────────────────────────────────────────────
// The families table has `parent_user_id uuid NOT NULL UNIQUE REFERENCES
// auth.users(id)` — a hard FK constraint that cannot be bypassed even by the
// service role. Seeded families therefore need a corresponding auth.users row.
// These accounts are created with email_confirm=false so they are functionally
// inert (no confirmed email, @ballpark.test domain is unreachable, no login
// possible without first completing email confirmation). They exist solely to
// satisfy the FK and are removed precisely by the delete script.
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
// Deterministic UUID map — PORTAL_SEED_ namespace
// Every record inserted by this script has a fixed UUID so the delete script
// can remove it precisely without touching real data.
//
// Scheme:  5eed{table:04}-{segment:04}-0000-0000-{index:012}
//   5eed0001 = coach auth users
//   5eed0002 = family auth users
//   5eed0003 = kids
//   5eed0004 = memberships
//   5eed0005 = payment_events  (second segment = membership index 1-15)
//   5eed0006 = bookings
//   5eed0007 = products
//   5eed0008 = points_ledger   (second segment = kid index 1-15)
//   5eed0009 = orders
// =============================================================================

function seedId(table, idx, seg2 = '0000') {
  return `5eed${String(table).padStart(4, '0')}-${seg2}-0000-0000-${String(idx).padStart(12, '0')}`;
}

// Auth user IDs (specified on create so they're deterministic):
const COACH_USER_IDS  = Array.from({ length: 4  }, (_, i) => seedId(1, i + 1));
const FAMILY_USER_IDS = Array.from({ length: 15 }, (_, i) => seedId(2, i + 1));

// Table row IDs:
const KID_IDS         = Array.from({ length: 15 }, (_, i) => seedId(3, i + 1));
const MEMBERSHIP_IDS  = Array.from({ length: 15 }, (_, i) => seedId(4, i + 1));
const PRODUCT_IDS     = Array.from({ length: 5  }, (_, i) => seedId(7, i + 1));
const ORDER_IDS       = Array.from({ length: 5  }, (_, i) => seedId(9, i + 1));

function paymentEventId(memIdx, monthSeq) {
  return seedId(5, monthSeq, String(memIdx + 1).padStart(4, '0'));
}

function bookingId(n) {
  return seedId(6, n);
}

function ledgerId(kidIdx, n) {
  return seedId(8, n, String(kidIdx + 1).padStart(4, '0'));
}

// =============================================================================
// REST helpers
// =============================================================================

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function restInsert(table, rows, conflictMode = 'ignore-duplicates') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...baseHeaders,
      Prefer: `return=minimal,resolution=${conflictMode}`,
    },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
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

async function adminRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: baseHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok && res.status !== 404) throw new Error(`${method} /admin/${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function ensureAuthUser(id, email, userMeta, emailConfirm = false) {
  // Check if user with this email already exists.
  const list = await adminRequest('GET', `users?filter=${encodeURIComponent(email)}`);
  const existing = (list?.users || []).find(u => u.email === email);
  if (existing) return { user: existing, created: false };

  const user = await adminRequest('POST', 'users', {
    id,                    // deterministic UUID — Supabase Admin API supports this
    email,
    password: `PortalSeed-${id.slice(-8)}-2026!`,
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

function monthsAgoDate(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

// Build UTC ISO timestamp for today at a given hour.
function todayAtUTC(hour) {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

// =============================================================================
// Data definitions
// =============================================================================

const COACH_DEFS = [
  { email: 'portal.coach.1@ballpark.test', first: 'Tyler',  last: 'Brooks', specialty: 'Hitting Coach'     },
  { email: 'portal.coach.2@ballpark.test', first: 'Alexis', last: 'Kim',    specialty: 'Pitching Coach'    },
  { email: 'portal.coach.3@ballpark.test', first: 'Jordan', last: 'Walsh',  specialty: 'Fielding Coach'    },
  { email: 'portal.coach.4@ballpark.test', first: 'Morgan', last: 'Davis',  specialty: 'Speed & Power'     },
];

// 15 families: parent name, kid name, membership plan, and engagement level.
// engagement = days since last completed booking (drives MIA / At-Risk logic).
const FAMILY_DEFS = [
  // idx 0-2: Private Hitting Lessons, active, low-churn (recent session 2d ago)
  { pFirst: 'Carlos',  pLast: 'Rivera',   kFirst: 'Marcus',   kLast: 'Rivera',   age: '12U', pos: 'SS',   plan: 'Private Hitting Lessons', planType: 'eft', amt: 14900, status: 'active',    anchor: 1,  joined: 14, lastSession: 2  },
  { pFirst: 'Rachel',  pLast: 'Lee',      kFirst: 'Jordan',   kLast: 'Lee',      age: '11U', pos: 'CF',   plan: 'Private Hitting Lessons', planType: 'eft', amt: 14900, status: 'active',    anchor: 4,  joined: 11, lastSession: 2  },
  { pFirst: 'Wei',     pLast: 'Chen',     kFirst: 'Tyler',    kLast: 'Chen',     age: '13U', pos: '1B',   plan: 'Private Hitting Lessons', planType: 'eft', amt: 14900, status: 'active',    anchor: 7,  joined: 9,  lastSession: 2  },
  // idx 3-5: Group Classes, active, medium-churn (10d ago)
  { pFirst: 'Priya',   pLast: 'Patel',    kFirst: 'Aria',     kLast: 'Patel',    age: '10U', pos: '2B',   plan: 'Group Classes',           planType: 'eft', amt:  7900, status: 'active',    anchor: 10, joined: 7,  lastSession: 10 },
  { pFirst: 'Mike',    pLast: 'Thompson', kFirst: 'Noah',     kLast: 'Thompson', age: '14U', pos: '3B',   plan: 'Group Classes',           planType: 'eft', amt:  7900, status: 'active',    anchor: 14, joined: 8,  lastSession: 10 },
  { pFirst: 'Ana',     pLast: 'Garcia',   kFirst: 'Emma',     kLast: 'Garcia',   age: '9U',  pos: 'OF',   plan: 'Group Classes',           planType: 'eft', amt:  7900, status: 'active',    anchor: 18, joined: 5,  lastSession: 10 },
  // idx 6-8: Team Training, active, high-churn (25d ago → at-risk)
  { pFirst: 'David',   pLast: 'Johnson',  kFirst: 'Liam',     kLast: 'Johnson',  age: '15U+',pos: 'P',    plan: 'Team Training',           planType: 'eft', amt: 11900, status: 'active',    anchor: 20, joined: 18, lastSession: 25 },
  { pFirst: 'Rosa',    pLast: 'Martinez', kFirst: 'Sofia',    kLast: 'Martinez', age: '11U', pos: 'C',    plan: 'Team Training',           planType: 'eft', amt: 11900, status: 'active',    anchor: 22, joined: 12, lastSession: 25 },
  { pFirst: 'James',   pLast: 'Williams', kFirst: 'Ethan',    kLast: 'Williams', age: '12U', pos: 'P',    plan: 'Team Training',           planType: 'eft', amt: 11900, status: 'active',    anchor: 25, joined: 10, lastSession: 25 },
  // idx 9: Cage Rental, OTC, active (3d ago)
  { pFirst: 'Lisa',    pLast: 'Brown',    kFirst: 'Olivia',   kLast: 'Brown',    age: '10U', pos: 'OF',   plan: 'Cage Rental',             planType: 'otc', amt:  4500, status: 'active',    anchor: null, joined: 6,  lastSession: 3  },
  // idx 10-11: Private Hitting, paused
  { pFirst: 'Marcus',  pLast: 'Davis',    kFirst: 'Aiden',    kLast: 'Davis',    age: '13U', pos: 'SS',   plan: 'Private Hitting Lessons', planType: 'eft', amt: 14900, status: 'paused',    anchor: 28, joined: 15, lastSession: 45 },
  { pFirst: 'Diana',   pLast: 'Wilson',   kFirst: 'Isabella', kLast: 'Wilson',   age: '14U', pos: 'C',    plan: 'Private Hitting Lessons', planType: 'eft', amt: 14900, status: 'paused',    anchor: 6,  joined: 8,  lastSession: 45 },
  // idx 12-14: Cage Rental, cancelled
  { pFirst: 'Robert',  pLast: 'Moore',    kFirst: 'Lucas',    kLast: 'Moore',    age: '11U', pos: '2B',   plan: 'Cage Rental',             planType: 'otc', amt:  4500, status: 'cancelled', anchor: null, joined: 20, lastSession: 90 },
  { pFirst: 'Sandra',  pLast: 'Taylor',   kFirst: 'Mia',      kLast: 'Taylor',   age: '10U', pos: 'OF',   plan: 'Cage Rental',             planType: 'otc', amt:  4500, status: 'cancelled', anchor: null, joined: 4,  lastSession: 90 },
  { pFirst: 'Kevin',   pLast: 'Anderson', kFirst: 'Logan',    kLast: 'Anderson', age: '15U+',pos: '1B',   plan: 'Cage Rental',             planType: 'otc', amt:  4500, status: 'cancelled', anchor: null, joined: 22, lastSession: 90 },
];

const PRODUCT_DEFS = [
  { name: 'Infinite Hitting Batting Gloves', category: 'apparel',    cost: 500,  inventory: 20  },
  { name: 'Facility Water Bottle',           category: 'gear',       cost: 250,  inventory: 50  },
  { name: '1-Hour Cage Rental',              category: 'sessions',   cost: 750,  inventory: null },
  { name: 'Infinite Hitting T-Shirt',        category: 'apparel',    cost: 350,  inventory: 30  },
  { name: 'Extra Lesson w/ Coach',           category: 'experience', cost: 1200, inventory: null },
];

// Target points balance per kid (descending for leaderboard visual interest):
const KID_POINTS = [820, 650, 590, 480, 440, 390, 370, 320, 290, 510, 180, 140, 60, 45, 30];

// =============================================================================
// 1. Coach auth users  (trigger creates coaches rows automatically)
// =============================================================================

console.log('\n─── COACHES ──────────────────────────────────────────────────────────');

const coachTableIds = []; // ID from public.coaches (auto-generated by trigger)
for (let i = 0; i < COACH_DEFS.length; i++) {
  const def = COACH_DEFS[i];
  const { user, created } = await ensureAuthUser(
    COACH_USER_IDS[i],
    def.email,
    { tenant_slug: 'infinitehitting', app_role: 'coach', first_name: def.first, last_name: def.last },
    true, // coaches can log in (existing pattern: see provision-coach-mike.mjs)
  );
  console.log(`  ${created ? '[new]' : '[skip]'} ${def.first} ${def.last} (auth id: ${user.id})`);

  // Fetch the coaches row created by handle_new_user trigger.
  const rows = await restGet(`coaches?user_id=eq.${user.id}&tenant_id=eq.${TENANT_ID}&select=id`);
  if (!rows.length) {
    console.error(`  ERROR: coaches row not found for ${def.email}. handle_new_user trigger may have failed.`);
    process.exit(1);
  }
  coachTableIds.push(rows[0].id);
}

// =============================================================================
// 2. Family auth users  (trigger creates families rows automatically)
//    email_confirm=false so these accounts cannot be used to log in.
// =============================================================================

console.log('\n─── FAMILIES + KIDS ─────────────────────────────────────────────────');

const familyIds = []; // auto-generated family UUIDs from public.families
for (let i = 0; i < FAMILY_DEFS.length; i++) {
  const def = FAMILY_DEFS[i];
  const email = `portal.family.${String(i + 1).padStart(2, '0')}@ballpark.test`;
  const { user, created } = await ensureAuthUser(
    FAMILY_USER_IDS[i],
    email,
    { tenant_slug: 'infinitehitting', first_name: def.pFirst, last_name: def.pLast },
    false, // email_confirm=false — inert account, exists only to satisfy FK
  );
  console.log(`  ${created ? '[new]' : '[skip]'} ${def.pFirst} ${def.pLast} / kid: ${def.kFirst} ${def.kLast}`);

  const famRows = await restGet(`families?parent_user_id=eq.${user.id}&tenant_id=eq.${TENANT_ID}&select=id`);
  if (!famRows.length) {
    console.error(`  ERROR: families row not found for ${email}. handle_new_user trigger may have failed.`);
    process.exit(1);
  }
  familyIds.push(famRows[0].id);

  // Insert kid with deterministic ID.
  await restInsert('kids', {
    id:               KID_IDS[i],
    family_id:        famRows[0].id,
    first_name:       def.kFirst,
    last_name:        def.kLast,
    age_group:        def.age,
    primary_position: def.pos,
    points_balance:   0,
  });
}
console.log(`  Kids: ${KID_IDS.length} rows (idempotent via ON CONFLICT id DO NOTHING)`);

// =============================================================================
// 3. Memberships
// =============================================================================

console.log('\n─── MEMBERSHIPS ──────────────────────────────────────────────────────');

const membershipRows = [];
for (let i = 0; i < FAMILY_DEFS.length; i++) {
  const def = FAMILY_DEFS[i];
  const row = {
    id:                  MEMBERSHIP_IDS[i],
    tenant_id:           TENANT_ID,
    family_id:           familyIds[i],
    kid_id:              KID_IDS[i],
    plan_name:           def.plan,
    plan_type:           def.planType,
    status:              def.status,
    amount_cents:        def.amt,
    started_at:          monthsAgoDate(def.joined),
    billing_anchor_day:  def.anchor ?? null,
    cancelled_at:        def.status === 'cancelled' ? daysAgo(30) : null,
  };
  membershipRows.push(row);
}
await restInsert('memberships', membershipRows);
console.log(`  ${membershipRows.length} memberships (idempotent via ON CONFLICT id DO NOTHING)`);

// =============================================================================
// 4. Payment Events  (12 months per membership — paid + sporadic failed)
// =============================================================================

console.log('\n─── PAYMENT EVENTS ───────────────────────────────────────────────────');

const failedReasons = ['insufficient_funds', 'card_declined', 'expired_card'];
const paymentRows = [];

for (let i = 0; i < FAMILY_DEFS.length; i++) {
  const def   = FAMILY_DEFS[i];
  const monthsToBill = Math.min(def.joined, 12);

  for (let m = monthsToBill; m >= 0; m--) {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    d.setDate(def.anchor ?? 1);
    d.setHours(10, 0, 0, 0);
    if (d > new Date()) continue;

    // ~15% of EFT events fail (not the current month, not OTC).
    const isFailed = def.planType === 'eft' && m > 0 && ((i * 13 + m) % 7 === 0);

    paymentRows.push({
      id:             paymentEventId(i, monthsToBill - m + 1),
      tenant_id:      TENANT_ID,
      family_id:      familyIds[i],
      membership_id:  MEMBERSHIP_IDS[i],
      amount_cents:   def.amt,
      status:         isFailed ? 'failed' : 'paid',
      payment_method: def.planType === 'eft' ? 'eft' : 'cash',
      error_code:     isFailed ? failedReasons[(i + m) % failedReasons.length] : null,
      created_at:     d.toISOString(),
    });
  }
}

// Insert in a single batch (idempotent via id conflict).
await restInsert('payment_events', paymentRows);
const paidCount   = paymentRows.filter(r => r.status === 'paid').length;
const failedCount = paymentRows.filter(r => r.status === 'failed').length;
console.log(`  ${paidCount} paid + ${failedCount} failed payment events seeded`);

// =============================================================================
// 5. Bookings
//    20 for today (Schedule cage grid) + 75 historical completed (engagement)
// =============================================================================

console.log('\n─── BOOKINGS ─────────────────────────────────────────────────────────');

const SESSION_TYPES = [ST_PRIVATE_60, ST_GROUP, ST_CAGE, ST_PRIVATE_60];

// Today's bookings: 20 slots across 8 cages and 4 time windows.
const todaySlots = [
  // 14:00 UTC block (8 bookings)
  { hour: 14, cage: '1', kidIdx: 0, coachIdx: 0 },
  { hour: 14, cage: '2', kidIdx: 1, coachIdx: 1 },
  { hour: 14, cage: '3', kidIdx: 2, coachIdx: 2 },
  { hour: 14, cage: '4', kidIdx: 3, coachIdx: 3 },
  { hour: 14, cage: '5', kidIdx: 4, coachIdx: 0 },
  { hour: 14, cage: '6', kidIdx: 5, coachIdx: 1 },
  { hour: 14, cage: '7', kidIdx: 6, coachIdx: 2 },
  { hour: 14, cage: '8', kidIdx: 7, coachIdx: 3 },
  // 15:00 UTC block (6 bookings)
  { hour: 15, cage: '1', kidIdx: 8, coachIdx: 0 },
  { hour: 15, cage: '2', kidIdx: 9, coachIdx: 1 },
  { hour: 15, cage: '3', kidIdx: 0, coachIdx: 2 },
  { hour: 15, cage: '4', kidIdx: 1, coachIdx: 3 },
  { hour: 15, cage: '5', kidIdx: 2, coachIdx: 0 },
  { hour: 15, cage: '6', kidIdx: 3, coachIdx: 1 },
  // 16:00 UTC block (4 bookings — pending)
  { hour: 16, cage: '1', kidIdx: 4, coachIdx: 2 },
  { hour: 16, cage: '2', kidIdx: 5, coachIdx: 3 },
  { hour: 16, cage: '3', kidIdx: 6, coachIdx: 0 },
  { hour: 16, cage: '4', kidIdx: 7, coachIdx: 1 },
  // 17:00 UTC block (2 bookings — pending)
  { hour: 17, cage: '1', kidIdx: 8, coachIdx: 2 },
  { hour: 17, cage: '2', kidIdx: 9, coachIdx: 3 },
];

const bookingRows = [];

// Today's bookings (IDs 1–20):
todaySlots.forEach((slot, idx) => {
  bookingRows.push({
    id:              bookingId(idx + 1),
    tenant_id:       TENANT_ID,
    location_id:     LOCATION_ID,
    kid_id:          KID_IDS[slot.kidIdx],
    coach_id:        coachTableIds[slot.coachIdx],
    session_type_id: SESSION_TYPES[slot.coachIdx % SESSION_TYPES.length],
    scheduled_start: todayAtUTC(slot.hour),
    scheduled_end:   todayAtUTC(slot.hour + 1),
    cage_number:     slot.cage,
    status:          slot.hour < 16 ? 'confirmed' : 'pending',
    attended_at:     null,
  });
});

// Historical completed bookings (IDs 21–95): 5 per kid, spaced 7d apart
// starting from lastSession days ago. These drive engagement scores and MIA.
let histId = 21;
for (let i = 0; i < FAMILY_DEFS.length; i++) {
  const def = FAMILY_DEFS[i];
  for (let j = 0; j < 5; j++) {
    const daysBack = def.lastSession + j * 7;
    const startDate = new Date(Date.now() - daysBack * 86_400_000);
    startDate.setUTCHours(14 + (j % 4), 0, 0, 0);
    const endDate = new Date(startDate.getTime() + 3_600_000);
    bookingRows.push({
      id:              bookingId(histId++),
      tenant_id:       TENANT_ID,
      location_id:     LOCATION_ID,
      kid_id:          KID_IDS[i],
      coach_id:        coachTableIds[(i + j) % coachTableIds.length],
      session_type_id: SESSION_TYPES[j % SESSION_TYPES.length],
      scheduled_start: startDate.toISOString(),
      scheduled_end:   endDate.toISOString(),
      cage_number:     String((j % 8) + 1),
      status:          'completed',
      attended_at:     endDate.toISOString(),
    });
  }
}

await restInsert('bookings', bookingRows);
console.log(`  ${todaySlots.length} today's bookings + ${bookingRows.length - todaySlots.length} historical completed`);

// =============================================================================
// 6. Products (5 store items)
// =============================================================================

console.log('\n─── PRODUCTS ─────────────────────────────────────────────────────────');

const productRows = PRODUCT_DEFS.map((def, i) => ({
  id:              PRODUCT_IDS[i],
  tenant_id:       TENANT_ID,
  name:            def.name,
  category:        def.category,
  points_cost:     def.cost,
  is_redeemable:   true,
  is_purchasable:  false,
  is_active:       true,
  sort_order:      i + 1,
  inventory_count: def.inventory ?? null,
}));

await restInsert('products', productRows);
console.log(`  ${productRows.length} products seeded`);

// =============================================================================
// 7. Points Ledger + kids.points_balance update
// =============================================================================

console.log('\n─── POINTS LEDGER ────────────────────────────────────────────────────');

const ledgerRows = [];

for (let i = 0; i < FAMILY_DEFS.length; i++) {
  const target = KID_POINTS[i];
  const sessionCredits = Math.floor(target * 0.7 / 10); // 10 pts per session
  let balance = 0;

  for (let j = 0; j < sessionCredits; j++) {
    balance += 10;
    ledgerRows.push({
      id:             ledgerId(i, j + 1),
      tenant_id:      TENANT_ID,
      kid_id:         KID_IDS[i],
      delta:          10,
      reason:         'session_attended',
      reference_type: 'manual',
      balance_after:  balance,
      note:           'Portal seed: session credit',
      created_at:     daysAgo(sessionCredits - j + 1),
    });
  }

  if (target > balance) {
    const topUp = target - balance;
    balance = target;
    ledgerRows.push({
      id:             ledgerId(i, sessionCredits + 1),
      tenant_id:      TENANT_ID,
      kid_id:         KID_IDS[i],
      delta:          topUp,
      reason:         'manual_adjustment',
      reference_type: 'manual',
      balance_after:  balance,
      note:           'Portal seed: balance adjustment',
      created_at:     daysAgo(1),
    });
  }
}

await restInsert('points_ledger', ledgerRows);
console.log(`  ${ledgerRows.length} ledger entries seeded across ${FAMILY_DEFS.length} kids`);

// Update kids.points_balance to match ledger totals.
for (let i = 0; i < FAMILY_DEFS.length; i++) {
  await fetch(`${SUPABASE_URL}/rest/v1/kids?id=eq.${KID_IDS[i]}`, {
    method: 'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ points_balance: KID_POINTS[i] }),
  });
}
console.log(`  kids.points_balance updated for all ${FAMILY_DEFS.length} kids`);

// =============================================================================
// 8. Orders (sample redemptions for Points & Rewards page)
// =============================================================================

console.log('\n─── ORDERS ───────────────────────────────────────────────────────────');

const ORDER_DEFS = [
  { kidIdx: 0, productIdx: 0, status: 'fulfilled', code: 'PSDM0001', daysBack: 14 },
  { kidIdx: 1, productIdx: 1, status: 'ordered',   code: 'PSDM0002', daysBack: 3  },
  { kidIdx: 2, productIdx: 2, status: 'ordered',   code: 'PSDM0003', daysBack: 5  },
  { kidIdx: 9, productIdx: 3, status: 'fulfilled', code: 'PSDM0004', daysBack: 21 },
  { kidIdx: 4, productIdx: 4, status: 'ordered',   code: 'PSDM0005', daysBack: 1  },
];

const orderRows = ORDER_DEFS.map((def, i) => {
  const createdAt = daysAgo(def.daysBack);
  return {
    id:                ORDER_IDS[i],
    tenant_id:         TENANT_ID,
    family_id:         familyIds[def.kidIdx],
    kid_id:            KID_IDS[def.kidIdx],
    product_id:        PRODUCT_IDS[def.productIdx],
    payment_method:    'points',
    amount_paid_points: PRODUCT_DEFS[def.productIdx].cost,
    status:            def.status,
    redemption_code:   def.code,
    created_at:        createdAt,
    fulfilled_at:      def.status === 'fulfilled' ? createdAt : null,
  };
});

await restInsert('orders', orderRows);
console.log(`  ${orderRows.length} sample orders seeded`);

// =============================================================================
// Done
// =============================================================================

console.log(`
=============================================================================
DONE — Portal demo data seeded for Infinite Hitting
=============================================================================
  Coaches:         4  (Tyler Brooks, Alexis Kim, Jordan Walsh, Morgan Davis)
  Families + Kids: 15 (10 active, 2 paused, 3 cancelled)
  Memberships:     15 (Private Hitting · Group Classes · Team Training · Cage)
  Payment Events:  ${paidCount} paid + ${failedCount} failed (12-month history)
  Bookings:        ${todaySlots.length} today + ${bookingRows.length - todaySlots.length} historical
  Products:        5 store items
  Points Ledger:   ${ledgerRows.length} entries
  Orders:          5 sample redemptions

  All records use deterministic UUIDs (5eed…).
  Cleanup: node scripts/delete-portal-seed-data.mjs
=============================================================================
`);
