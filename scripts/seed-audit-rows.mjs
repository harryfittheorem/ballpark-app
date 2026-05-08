#!/usr/bin/env node
// =============================================================================
// scripts/seed-audit-rows.mjs
// =============================================================================
// Seeds one minimum sentinel row per (tenant, table) for every tenant-scoped
// table the cross-tenant audit probes (task #86). Without this seeding the
// audit's SELECT-by-id and UPDATE probes skip when an opposite-tenant row
// doesn't exist, leaving coverage gaps that the architect flagged.
//
// Tables seeded per tenant (T1 = Infinite Hitting, T2 = Test Tenant Two):
//   coach_availability, bookings, videos, coach_messages, assignments,
//   products, orders, points_ledger
//
// Already covered by other seeds / fixtures:
//   tenants, locations, session_types, coaches, families, kids
//
// Idempotent: every row uses a deterministic UUID and is upserted with
// `Prefer: resolution=ignore-duplicates` (Supabase REST honours this for
// PK-conflict NO-OP). Re-running mutates nothing.
//
// Usage:
//   node scripts/seed-audit-rows.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

async function rest(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${url}/rest/v1${path}`, {
    method,
    headers: { ...adminHeaders, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (res.status >= 400) throw new Error(`REST ${method} ${path} ${res.status}: ${text}`);
  return json;
}

async function get(path) {
  return rest('GET', path);
}

// `Prefer: resolution=ignore-duplicates` makes Supabase treat a PK
// collision as a no-op INSERT instead of an error. Combined with
// `return=representation` we always get the row back.
async function upsert(table, row) {
  const headers = {
    Prefer: 'return=representation,resolution=ignore-duplicates',
  };
  const arr = await rest('POST', `/${table}`, [row], headers);
  if (Array.isArray(arr) && arr.length > 0) return arr[0];
  // No row returned (= already existed and ignored). Re-fetch by id.
  const existing = await get(`/${table}?id=eq.${row.id}&select=*`);
  return existing?.[0];
}

const T1 = '00000000-0000-0000-0000-000000000001';
const T2 = '00000000-0000-0000-0000-000000000002';

const PARENT_EMAIL = { [T1]: 'audit.parent.t1@ballpark.test', [T2]: 'audit.parent.t2@ballpark.test' };
const COACH_EMAIL  = { [T1]: 'audit.coach.t1@ballpark.test',  [T2]: 'audit.coach.t2@ballpark.test'  };

// Deterministic sentinel UUIDs. Suffix '0a01' = audit row 1 tenant 1, etc.
function id(table, tenantId) {
  // Embed table-shortcode + tenant-suffix for greppability.
  // Note: UUID hex chars only (0-9, a-f). Codes are mnemonics squeezed
  // into that alphabet, not the actual table-name initials.
  const codes = {
    coach_availability: 'ca',
    bookings:           'b0',
    videos:             'fa',
    coach_messages:     'cb',
    assignments:        'a5',
    products:           'fd',
    orders:             '0d',
    points_ledger:      'fb',
  };
  const tenantSuffix = tenantId === T1 ? '0001' : '0002';
  // Format: aaaaaaa{code}-0000-0000-0000-{tenantSuffix}{padding}
  return `aaaaaa${codes[table]}-0000-0000-0000-${tenantSuffix}00000000`.slice(0, 36);
}

async function lookupCoachUserId(tenantId) {
  const rows = await get(`/auth.users?email=eq.${encodeURIComponent(COACH_EMAIL[tenantId])}`);
  // auth.users isn't exposed by PostgREST in the public schema by default;
  // use the admin REST API instead.
  if (!rows) return null;
  return rows?.[0]?.id ?? null;
}

async function lookupAdminUserId(email) {
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: adminHeaders });
  const body = await res.json();
  if (res.status >= 400) throw new Error(`admin list ${res.status}: ${JSON.stringify(body)}`);
  const u = (body?.users || []).find((x) => x.email === email);
  return u?.id ?? null;
}

async function ctxFor(tenantId) {
  // Resolve all the FK targets we need for this tenant.
  const parentUserId = await lookupAdminUserId(PARENT_EMAIL[tenantId]);
  const coachUserId  = await lookupAdminUserId(COACH_EMAIL[tenantId]);
  if (!parentUserId || !coachUserId) {
    throw new Error(`fixtures missing for tenant ${tenantId} — run scripts/provision-audit-fixtures.mjs first`);
  }

  const fams = await get(`/families?parent_user_id=eq.${parentUserId}&select=id`);
  const familyId = fams?.[0]?.id;
  if (!familyId) throw new Error(`no family for parent ${parentUserId} in tenant ${tenantId}`);

  const kids = await get(`/kids?family_id=eq.${familyId}&select=id&limit=1`);
  const kidId = kids?.[0]?.id;
  if (!kidId) throw new Error(`no kid for family ${familyId} in tenant ${tenantId}`);

  const coachRows = await get(`/coaches?user_id=eq.${coachUserId}&select=id`);
  const coachId = coachRows?.[0]?.id;
  if (!coachId) throw new Error(`no coach record for user ${coachUserId} in tenant ${tenantId}`);

  const locs = await get(`/locations?tenant_id=eq.${tenantId}&select=id&limit=1`);
  const locationId = locs?.[0]?.id;
  if (!locationId) throw new Error(`no location for tenant ${tenantId}`);

  const sts = await get(`/session_types?tenant_id=eq.${tenantId}&select=id&limit=1`);
  const sessionTypeId = sts?.[0]?.id;
  if (!sessionTypeId) throw new Error(`no session_type for tenant ${tenantId}`);

  return { tenantId, parentUserId, coachUserId, familyId, kidId, coachId, locationId, sessionTypeId };
}

async function seedTenant(ctx) {
  const { tenantId } = ctx;
  console.log(`\n=== Seeding tenant ${tenantId} ===`);
  const out = {};

  // 1. coach_availability ---------------------------------------------------
  out.coach_availability = await upsert('coach_availability', {
    id: id('coach_availability', tenantId),
    tenant_id: tenantId,
    coach_id: ctx.coachId,
    location_id: ctx.locationId,
    day_of_week: 1,
    start_time: '09:00:00',
    end_time: '12:00:00',
    is_recurring: true,
  });
  console.log(`  coach_availability  ${out.coach_availability.id}`);

  // 2. videos ---------------------------------------------------------------
  // mux_asset_id and mux_playback_id are UNIQUE — derive deterministically.
  const muxAssetId    = `audit-asset-${tenantId.slice(-4)}`;
  const muxPlaybackId = `audit-playback-${tenantId.slice(-4)}`;
  out.videos = await upsert('videos', {
    id: id('videos', tenantId),
    tenant_id: tenantId,
    uploaded_by_user_id: ctx.coachUserId,
    mux_asset_id: muxAssetId,
    mux_playback_id: muxPlaybackId,
    duration_seconds: 30,
    status: 'ready',
    title: `Audit sentinel (${tenantId.slice(-4)})`,
    purpose: 'coach_message',
  });
  console.log(`  videos              ${out.videos.id}`);

  // 3. bookings -------------------------------------------------------------
  out.bookings = await upsert('bookings', {
    id: id('bookings', tenantId),
    tenant_id: tenantId,
    location_id: ctx.locationId,
    kid_id: ctx.kidId,
    coach_id: ctx.coachId,
    session_type_id: ctx.sessionTypeId,
    scheduled_start: '2026-12-31T15:00:00Z',
    scheduled_end:   '2026-12-31T16:00:00Z',
    status: 'pending',
    notes: 'audit sentinel',
  });
  console.log(`  bookings            ${out.bookings.id}`);

  // 4. coach_messages -------------------------------------------------------
  out.coach_messages = await upsert('coach_messages', {
    id: id('coach_messages', tenantId),
    tenant_id: tenantId,
    video_id: out.videos.id,
    sender_user_id: ctx.coachUserId,
    recipient_family_id: ctx.familyId,
    recipient_kid_id: ctx.kidId,
    message_text: 'audit sentinel',
  });
  console.log(`  coach_messages      ${out.coach_messages.id}`);

  // 5. assignments ----------------------------------------------------------
  out.assignments = await upsert('assignments', {
    id: id('assignments', tenantId),
    tenant_id: tenantId,
    kid_id: ctx.kidId,
    family_id: ctx.familyId,
    coach_user_id: ctx.coachUserId,
    title: 'Audit sentinel drill',
    point_reward: 25,
    status: 'pending',
  });
  console.log(`  assignments         ${out.assignments.id}`);

  // 6. products -------------------------------------------------------------
  out.products = await upsert('products', {
    id: id('products', tenantId),
    tenant_id: tenantId,
    name: 'Audit Sentinel Reward',
    category: 'gear',
    points_cost: 100,
    is_redeemable: true,
    is_active: true,
  });
  console.log(`  products            ${out.products.id}`);

  // 7. orders ---------------------------------------------------------------
  // redemption_code is UNIQUE; derive from tenant suffix so re-runs don't
  // collide.
  out.orders = await upsert('orders', {
    id: id('orders', tenantId),
    tenant_id: tenantId,
    family_id: ctx.familyId,
    kid_id: ctx.kidId,
    product_id: out.products.id,
    payment_method: 'points',
    amount_paid_points: 100,
    status: 'ordered',
    redemption_code: `AUDT${tenantId.slice(-4)}`,
  });
  console.log(`  orders              ${out.orders.id}`);

  // 8. points_ledger --------------------------------------------------------
  // Use reason='manual_adjustment' + reference_type='manual' to dodge any
  // partial unique indexes (the assignment_completed/redemption uniques key
  // on reference_id which is null here).
  out.points_ledger = await upsert('points_ledger', {
    id: id('points_ledger', tenantId),
    tenant_id: tenantId,
    kid_id: ctx.kidId,
    delta: 1,
    reason: 'manual_adjustment',
    reference_type: 'manual',
    balance_after: 1,
    note: 'audit sentinel',
  });
  console.log(`  points_ledger       ${out.points_ledger.id}`);

  return out;
}

const ctx1 = await ctxFor(T1);
const ctx2 = await ctxFor(T2);
console.log('Resolved fixture context for both tenants.');
console.log('  T1:', { family: ctx1.familyId, kid: ctx1.kidId, coach: ctx1.coachId });
console.log('  T2:', { family: ctx2.familyId, kid: ctx2.kidId, coach: ctx2.coachId });

await seedTenant(ctx1);
await seedTenant(ctx2);

console.log('\n=== Done. All probe target rows present in both tenants. ===');
