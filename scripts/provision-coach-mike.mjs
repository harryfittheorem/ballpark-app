#!/usr/bin/env node
// =============================================================================
// scripts/provision-coach-mike.mjs
// =============================================================================
// One-shot: admin-create coach.mike@infinitehitting.com with the raw user
// metadata that handle_new_user (v0.4 Step 4.2) needs to route into
// public.coaches. The dashboard "Add user" form does not expose
// raw_user_meta_data, so this script uses the Admin REST API instead.
//
// Usage:
//   node scripts/provision-coach-mike.mjs <password>
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent-ish: if the email already exists, prints the existing user_id
// and exits 0 without re-inserting (so you can re-run safely).
// =============================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = 'coach.mike@infinitehitting.com';
const password = process.argv[2];

if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(2);
}
if (!password) {
  console.error('Usage: node scripts/provision-coach-mike.mjs <password>');
  process.exit(2);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

// Check existing first.
const list = await fetch(`${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, {
  headers: adminHeaders,
});
const listBody = await list.json();
const existing = (listBody?.users || []).find((u) => u.email === email);
if (existing) {
  console.log(`-> already exists: user_id=${existing.id}`);
  console.log('   (metadata not re-applied; handle_new_user only fires on INSERT.)');
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
      app_role: 'coach',
      first_name: 'Mike',
      last_name: 'Anderson',
    },
  }),
});
const body = await create.json();
if (create.status >= 400) {
  console.error(`FAIL (${create.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}
console.log(`PASS: created user_id=${body.id}`);
console.log('     handle_new_user should have inserted a public.coaches row for this user.');
