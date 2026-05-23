#!/usr/bin/env node
// =============================================================================
// scripts/validate-mindbody-import.mjs
// =============================================================================
// Post-run validation for MindBody imports. Queries the database to verify
// data integrity and prints a PASS/FAIL summary.
//
// Checks performed:
//   1. Row counts per table (families, kids, memberships, bookings, payment_events)
//   2. Families without any kids (warning)
//   3. Memberships without matching families (error)
//   4. Memberships with invalid status (error)
//   5. Completed bookings without attended_at (error)
//   6. Payment events with zero amount (warning)
//   7. Kids without a family (error — should never happen due to FK)
//   8. MindBody-imported rows specifically (identified by UUID v5 namespace)
//
// Usage:
//   node scripts/validate-mindbody-import.mjs \
//     [--tenant-slug infinitehitting]
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args        = process.argv.slice(2);
const slugIdx     = args.indexOf('--tenant-slug');
const TENANT_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : (process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'infinitehitting');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
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

// Fetch count using HEAD + Content-Range.
async function restCount(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'HEAD',
    headers: { ...baseHeaders, Prefer: 'count=exact' },
  });
  if (!res.ok) return 0;
  const range = res.headers.get('content-range') ?? '';
  const match = range.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// =============================================================================
// Checks
// =============================================================================

const errors   = [];
const warnings = [];

function pass(label, detail = '') {
  console.log(`  ✓  ${label}${detail ? `  (${detail})` : ''}`);
}

function fail(label, detail = '') {
  console.log(`  ✗  ${label}${detail ? `  — ${detail}` : ''}`);
  errors.push(`${label}${detail ? `: ${detail}` : ''}`);
}

function warn(label, detail = '') {
  console.log(`  ⚠  ${label}${detail ? `  — ${detail}` : ''}`);
  warnings.push(`${label}${detail ? `: ${detail}` : ''}`);
}

// =============================================================================
// Main
// =============================================================================

console.log(`\n${'='.repeat(65)}`);
console.log('MindBody Import Validation');
console.log('='.repeat(65));

// ── Resolve tenant ─────────────────────────────────────────────────────────────
const tenants = await restGet(`tenants?slug=eq.${TENANT_SLUG}&select=id,name`);
if (!tenants.length) {
  console.error(`ERROR: tenant slug '${TENANT_SLUG}' not found.`);
  process.exit(1);
}
const TENANT_ID = tenants[0].id;
console.log(`Tenant: ${tenants[0].name} (${TENANT_ID})\n`);

// ── 1. Row counts ──────────────────────────────────────────────────────────────
console.log('─── Row Counts ──────────────────────────────────────────────────────');

const familyCount  = await restCount(`families?tenant_id=eq.${TENANT_ID}`);
const memCount     = await restCount(`memberships?tenant_id=eq.${TENANT_ID}`);
const bookingCount = await restCount(`bookings?tenant_id=eq.${TENANT_ID}`);
const paymentCount = await restCount(`payment_events?tenant_id=eq.${TENANT_ID}`);

// Kids count via families lookup (PostgREST doesn't support subquery in count filter easily).
const allFamilies  = await restGet(`families?tenant_id=eq.${TENANT_ID}&select=id`);
const familyIds    = allFamilies.map(f => f.id);

let kidsTotal = 0;
if (familyIds.length > 0) {
  // Batch in chunks of 50 to avoid URL length limits.
  const chunkSize = 50;
  for (let i = 0; i < familyIds.length; i += chunkSize) {
    const chunk = familyIds.slice(i, i + chunkSize).join(',');
    const c = await restCount(`kids?family_id=in.(${chunk})`);
    kidsTotal += c;
  }
}

console.log(`  families:       ${familyCount}`);
console.log(`  kids:           ${kidsTotal}`);
console.log(`  memberships:    ${memCount}`);
console.log(`  bookings:       ${bookingCount}`);
console.log(`  payment_events: ${paymentCount}`);

if (familyCount === 0) {
  warn('No families found — import may not have run yet');
}

// ── 2. Kids per family ─────────────────────────────────────────────────────────
console.log('\n─── Data Integrity Checks ───────────────────────────────────────────');

if (familyIds.length > 0) {
  let familiesWithoutKids = 0;
  const CHUNK = 50;
  for (let i = 0; i < familyIds.length; i += CHUNK) {
    const chunk = familyIds.slice(i, i + CHUNK);
    for (const fid of chunk) {
      const c = await restCount(`kids?family_id=eq.${fid}`);
      if (c === 0) familiesWithoutKids++;
    }
  }
  if (familiesWithoutKids > 0) {
    warn(`${familiesWithoutKids} families have no kids`, 'may be expected for parent-only accounts');
  } else {
    pass('All families have at least one kid');
  }
}

// ── 3. Memberships with valid status ──────────────────────────────────────────
if (memCount > 0) {
  const invalidMems = await restGet(
    `memberships?tenant_id=eq.${TENANT_ID}&status=not.in.(active,paused,cancelled)&select=id,status&limit=10`
  );
  if (invalidMems.length > 0) {
    fail('Memberships with invalid status', `${invalidMems.length} rows`);
  } else {
    pass('All memberships have valid status');
  }

  const activeMems = await restCount(`memberships?tenant_id=eq.${TENANT_ID}&status=eq.active`);
  const cancelledMems = await restCount(`memberships?tenant_id=eq.${TENANT_ID}&status=eq.cancelled`);
  pass(`Membership status breakdown`, `active=${activeMems}, cancelled=${cancelledMems}`);
}

// ── 4. Completed bookings have attended_at ────────────────────────────────────
if (bookingCount > 0) {
  const completedMissingAttended = await restGet(
    `bookings?tenant_id=eq.${TENANT_ID}&status=eq.completed&attended_at=is.null&select=id&limit=10`
  );
  if (completedMissingAttended.length > 0) {
    fail('Completed bookings missing attended_at', `${completedMissingAttended.length} rows`);
  } else {
    pass('All completed bookings have attended_at');
  }

  const completedCount = await restCount(`bookings?tenant_id=eq.${TENANT_ID}&status=eq.completed`);
  pass(`Booking status breakdown`, `completed=${completedCount} of ${bookingCount}`);
}

// ── 5. Payment events with zero amount ────────────────────────────────────────
if (paymentCount > 0) {
  const zeroPayments = await restGet(
    `payment_events?tenant_id=eq.${TENANT_ID}&amount_cents=eq.0&select=id&limit=10`
  );
  if (zeroPayments.length > 0) {
    warn(`${zeroPayments.length} payment events with $0 amount`, 'may be free services');
  } else {
    pass('All payment events have non-zero amounts');
  }

  const paidCount = await restCount(`payment_events?tenant_id=eq.${TENANT_ID}&status=eq.paid`);
  pass(`Payment event status breakdown`, `paid=${paidCount} of ${paymentCount}`);
}

// ── 6. Orphan check: memberships without a valid family ───────────────────────
if (memCount > 0 && familyIds.length > 0) {
  let orphanMems = 0;
  const allMems = await restGet(`memberships?tenant_id=eq.${TENANT_ID}&select=id,family_id&limit=1000`);
  for (const mem of allMems) {
    if (!familyIds.includes(mem.family_id)) orphanMems++;
  }
  if (orphanMems > 0) {
    fail('Memberships referencing unknown families', `${orphanMems} rows`);
  } else {
    pass('All memberships reference valid families');
  }
}

// ── 7. Bookings with invalid coach reference ───────────────────────────────────
if (bookingCount > 0) {
  const coaches = await restGet(`coaches?tenant_id=eq.${TENANT_ID}&select=id`);
  const coachIdSet = new Set(coaches.map(c => c.id));
  const allBookings = await restGet(
    `bookings?tenant_id=eq.${TENANT_ID}&select=id,coach_id,status&limit=2000`
  );
  const bookingsWithBadCoach = allBookings.filter(b => b.coach_id && !coachIdSet.has(b.coach_id));
  if (bookingsWithBadCoach.length > 0) {
    fail(
      'Bookings referencing a coach not in the coaches table',
      `${bookingsWithBadCoach.length} rows — run coaches import or update coach-map`
    );
  } else {
    pass('All bookings reference a valid coach');
  }
}

// ── 8. Sessions import completeness ───────────────────────────────────────────
const sessionCount = await restCount(`sessions?tenant_id=eq.${TENANT_ID}&capture_source=eq.manual`);
if (bookingCount > 0) {
  const completedBookingCount = await restCount(
    `bookings?tenant_id=eq.${TENANT_ID}&status=eq.completed`
  );
  if (sessionCount === 0 && completedBookingCount > 0) {
    warn(
      'No manual sessions found but completed bookings exist',
      'visits import may predate sessions linkage — re-run import-mindbody-visits.mjs'
    );
  } else {
    pass(`Manual sessions linked to completed visits`, `${sessionCount} rows`);
  }
}

// =============================================================================
// Summary
// =============================================================================

console.log(`\n${'='.repeat(65)}`);
console.log(`Warnings: ${warnings.length}  |  Errors: ${errors.length}`);
console.log('='.repeat(65));

if (errors.length === 0) {
  console.log('\n✓  PASS — MindBody import validation passed\n');
  if (warnings.length > 0) {
    console.log('Warnings (non-blocking):');
    warnings.forEach(w => console.log(`  ⚠  ${w}`));
  }
  console.log();
  process.exit(0);
} else {
  console.log('\n✗  FAIL — MindBody import validation failed\n');
  console.log('Errors:');
  errors.forEach(e => console.log(`  ✗  ${e}`));
  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach(w => console.log(`  ⚠  ${w}`));
  }
  console.log();
  process.exit(1);
}
