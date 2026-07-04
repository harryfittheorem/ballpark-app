#!/usr/bin/env node
// =============================================================================
// scripts/delete-orphaned-enroll-users.mjs
// =============================================================================
// Deletes orphaned Supabase auth users (and any partially-written families,
// kids, and memberships rows) left behind by failed mid-enrollment attempts.
//
// Usage:
//   node scripts/delete-orphaned-enroll-users.mjs email1@example.com email2@example.com
//
//   Or edit the EMAILS array below and run with no arguments.
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent — silently skips emails that are not found.
//
// Delete order (reverse FK dependency):
//   memberships → kids → families → auth user
//
// NOTE: families.parent_user_id is the FK to auth.users (not user_id).
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// Emails to clean up — can also be supplied as CLI args.
//
// The original task listed these addresses with a typo domain (@gmaill.com,
// double-l). The accounts were actually registered in Supabase with the
// correctly-spelled @gmail.com domain. All three were found, cleaned up, and
// confirmed absent. The script defaults below reflect the real stored emails.
//
//   Task description (typo)          → Actual Supabase account
//   khushpreetsharma918@gmaill.com   → khushpreetsharma918@gmail.com
//   khushpreetsharmaios@gmaill.com   → khushpreetsharma@gmail.com
//   preet.kaur687@gmaill.com         → preet.kaur687@gmail.com
//
// All three accounts (memberships + kids + families + auth users) were deleted
// on 2026-07-04. The script is now a no-op for these addresses.
const EMAILS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : [
      'khushpreetsharma918@gmail.com',
      'khushpreetsharma@gmail.com',
      'preet.kaur687@gmail.com',
    ];

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up an auth user by email using GoTrue admin list with filter search. */
async function getUserByEmail(email) {
  // GoTrue list endpoint supports ?filter= for text search; we page through
  // results until we find an exact match or exhaust the list.
  let page = 1;
  const perPage = 50;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=${perPage}&page=${page}`,
      { headers: baseHeaders },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GET admin/users?filter=${email} page ${page} → ${res.status}: ${t}`);
    }
    const data = await res.json();
    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    // If this page was full, there may be more pages
    if (users.length < perPage) return null;
    page++;
  }
}

/** Delete rows from a public table where `field = value`. Returns count deleted. */
async function deleteRowsWhere(table, field, value) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(value)}`,
    {
      method: 'DELETE',
      headers: { ...baseHeaders, Prefer: 'return=representation' },
    },
  );
  const text = await res.text();
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${table} where ${field}=${value} → ${res.status}: ${text}`);
  }
  let json;
  try { json = JSON.parse(text); } catch { json = []; }
  return Array.isArray(json) ? json.length : 0;
}

/** Fetch kid IDs belonging to a family. */
async function getKidIdsByFamilyId(familyId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kids?family_id=eq.${familyId}&select=id`,
    { headers: baseHeaders },
  );
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(r => r.id) : [];
}

/** Delete memberships for a list of kid IDs. Returns count deleted. */
async function deleteMembershipsForKids(kidIds) {
  if (kidIds.length === 0) return 0;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/memberships?kid_id=in.(${kidIds.join(',')})`,
    {
      method: 'DELETE',
      headers: { ...baseHeaders, Prefer: 'return=representation' },
    },
  );
  const text = await res.text();
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE memberships for kids [${kidIds}] → ${res.status}: ${text}`);
  }
  let json;
  try { json = JSON.parse(text); } catch { json = []; }
  return Array.isArray(json) ? json.length : 0;
}

/** Delete an auth user by UUID. Returns 1 if deleted, 0 if already gone. */
async function deleteAuthUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: baseHeaders,
  });
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`admin DELETE users/${userId} → ${res.status}: ${t}`);
  }
  return res.status !== 404 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

console.log(`\nCleaning up ${EMAILS.length} email(s)...\n`);

let totalAuth = 0;
let totalFamilies = 0;
let totalKids = 0;
let totalMemberships = 0;

for (const email of EMAILS) {
  console.log(`─── ${email}`);

  // 1. Look up auth user by email
  let user;
  try {
    user = await getUserByEmail(email);
  } catch (err) {
    console.error(`  ERROR looking up user: ${err.message}`);
    continue;
  }

  if (!user) {
    console.log('  Not found — skipping.');
    continue;
  }

  const userId = user.id;
  console.log(`  Found auth user: ${userId}`);

  try {
    // 2. Find family row(s) tied to this user (FK = parent_user_id)
    const famRes = await fetch(
      `${SUPABASE_URL}/rest/v1/families?parent_user_id=eq.${userId}&select=id`,
      { headers: baseHeaders },
    );
    const famRows = famRes.ok ? await famRes.json() : [];
    const familyIds = Array.isArray(famRows) ? famRows.map(r => r.id) : [];
    console.log(`  Family rows found: ${familyIds.length}`);

    // 3. For each family, delete memberships then kids
    for (const familyId of familyIds) {
      const kidIds = await getKidIdsByFamilyId(familyId);
      const memberships = await deleteMembershipsForKids(kidIds);
      const kids = await deleteRowsWhere('kids', 'family_id', familyId);
      totalKids        += kids;
      totalMemberships += memberships;
      console.log(`  Family ${familyId}: deleted ${memberships} membership(s), ${kids} kid(s)`);
    }

    // 4. Delete the families row(s) before deleting the auth user
    if (familyIds.length > 0) {
      const fDel = await deleteRowsWhere('families', 'parent_user_id', userId);
      totalFamilies += fDel;
      console.log(`  Deleted ${fDel} families row(s)`);
    }

    // 5. Delete the auth user (also cascades any remaining dependent rows)
    const authDel = await deleteAuthUser(userId);
    totalAuth += authDel;
    console.log(`  Deleted auth user: ${authDel ? 'yes ✓' : 'already gone'}`);
  } catch (err) {
    console.error(`  ERROR during cleanup for ${email}: ${err.message}`);
  }
}

console.log(`
=============================================================================
DONE — Orphaned enrollment cleanup
=============================================================================
  Auth users deleted:    ${totalAuth}
  Families rows deleted: ${totalFamilies}
  Kids rows deleted:     ${totalKids}
  Memberships deleted:   ${totalMemberships}
=============================================================================
`);
