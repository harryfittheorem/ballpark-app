#!/usr/bin/env node
// =============================================================================
// scripts/provision-owner.mjs
// =============================================================================
// One-shot: admin-create owner@infinitehitting.com with app_role='owner'.
// The Custom Access Token Hook injects app_role into the JWT so the portal
// router redirects this user straight to /owner on login.
//
// Usage:
//   node scripts/provision-owner.mjs <password>
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent: if the email already exists, prints the existing user_id and
// exits 0 without modifying anything.
// =============================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = 'owner@infinitehitting.com';
const password = process.argv[2];

if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(2);
}
if (!password) {
  console.error('Usage: node scripts/provision-owner.mjs <password>');
  process.exit(2);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

const list = await fetch(`${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, {
  headers: adminHeaders,
});
const listBody = await list.json();
const existing = (listBody?.users || []).find((u) => u.email === email);
if (existing) {
  console.log(`-> already exists: user_id=${existing.id}`);
  console.log('   (metadata not re-applied; re-run is a no-op)');
  process.exit(0);
}

console.log(`-> admin create: ${email}`);
const create = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      tenant_slug: 'infinitehitting',
      app_role: 'owner',
      first_name: 'Owner',
      last_name: 'Ballpark',
    },
  }),
});
const body = await create.json();
if (create.status >= 400) {
  console.error(`FAIL (${create.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}
console.log(`PASS: created user_id=${body.id}`);
console.log(`      email: ${email}`);
console.log('      The JWT app_role claim will be "owner" on next sign-in.');
