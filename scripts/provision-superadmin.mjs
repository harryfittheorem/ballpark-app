#!/usr/bin/env node
// =============================================================================
// scripts/provision-superadmin.mjs
// =============================================================================
// Creates a super-admin account that can access the /hq console.
//
// Usage:
//   node scripts/provision-superadmin.mjs <email> <password> <name>
//
// Example:
//   node scripts/provision-superadmin.mjs admin@infinitehitting.com 'S3cret!' 'Alex Smith'
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent: if the email already exists, checks for a super_admins row and
// inserts it if missing, then exits 0.
// =============================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, password, name] = process.argv.slice(2);

if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(2);
}
if (!email || !password || !name) {
  console.error('Usage: node scripts/provision-superadmin.mjs <email> <password> <name>');
  process.exit(2);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

// ─── Step 1: check for existing user ─────────────────────────────────────────
const listRes = await fetch(
  `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
  { headers: adminHeaders },
);
const listBody = await listRes.json();
const existing = (listBody?.users ?? []).find((u) => u.email === email);
let userId;

if (existing) {
  console.log(`-> user already exists: user_id=${existing.id}`);
  userId = existing.id;
} else {
  // ─── Step 2: create auth user ───────────────────────────────────────────────
  console.log(`-> creating auth user: ${email}`);
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        app_role: 'super_admin',
        name,
      },
    }),
  });
  const createBody = await createRes.json();
  if (createRes.status >= 400) {
    console.error(`FAIL (${createRes.status}):`, JSON.stringify(createBody, null, 2));
    process.exit(1);
  }
  userId = createBody.id;
  console.log(`-> auth user created: user_id=${userId}`);
}

// ─── Step 3: upsert super_admins row ─────────────────────────────────────────
console.log(`-> upserting super_admins row for user_id=${userId}`);
const upsertRes = await fetch(`${url}/rest/v1/super_admins`, {
  method: 'POST',
  headers: {
    ...adminHeaders,
    Prefer: 'resolution=merge-duplicates',
  },
  body: JSON.stringify({
    user_id: userId,
    name,
    email,
  }),
});

if (upsertRes.status >= 400) {
  const errBody = await upsertRes.text();
  console.error(`FAIL upsert super_admins (${upsertRes.status}):`, errBody);
  process.exit(1);
}

console.log(`\nPASS: super-admin provisioned.`);
console.log(`  email:   ${email}`);
console.log(`  user_id: ${userId}`);
console.log(`  name:    ${name}`);
console.log(`\nThe user can now log in at the portal and will be routed to /hq.`);
console.log(`Note: JWTs are cached — the user must sign out and back in if they`);
console.log(`      were previously signed in with a different role.`);
