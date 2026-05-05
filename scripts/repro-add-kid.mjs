#!/usr/bin/env node
// Reproduce the AddKidScreen insert path end-to-end against the real Supabase
// project so we can capture the exact PostgREST error the app would see.
//
// Mirrors useFamily.useAddKid:
//   1. Admin-create a throwaway user (handle_new_user trigger provisions the family).
//   2. Sign in to mint a JWT (so RLS runs as that user).
//   3. SELECT the family row via PostgREST under that JWT.
//   4. INSERT a kid row via PostgREST under that JWT.
//   5. Print the response status + body for each step, then clean up.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantSlug = process.env.EXPO_PUBLIC_TENANT_SLUG || 'infinitehitting';

if (!url || !anon || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

const rand = Math.random().toString(36).slice(2, 10);
const email = `addkidrepro_${rand}@hooksmoketest.dev`;
const password = `Test_${rand}_pw!`;
let userId;

async function cleanup() {
  if (!userId) return;
  await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: adminHeaders });
  console.log(`-> cleanup: deleted ${userId}`);
}

try {
  console.log(`-> admin create user ${email}  tenant_slug=${tenantSlug}`);
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { tenant_slug: tenantSlug, first_name: 'Repro', last_name: 'Kid' },
    }),
  });
  const createBody = await createRes.json();
  if (createRes.status >= 400) {
    console.error('admin create failed:', createRes.status, JSON.stringify(createBody, null, 2));
    process.exit(1);
  }
  userId = createBody.id || createBody.user?.id;
  console.log(`   user_id=${userId}`);

  console.log('-> signin as that user');
  const signinRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ email, password }),
  });
  const signinBody = await signinRes.json();
  if (signinRes.status >= 400) {
    console.error('signin failed:', signinRes.status, JSON.stringify(signinBody, null, 2));
    await cleanup();
    process.exit(1);
  }
  const token = signinBody.access_token;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  console.log('   JWT custom claims:', JSON.stringify({
    sub: claims.sub, tenant_id: claims.tenant_id, family_id: claims.family_id, app_role: claims.app_role, role: claims.role,
  }, null, 2));

  const userHeaders = {
    'Content-Type': 'application/json',
    apikey: anon,
    Authorization: `Bearer ${token}`,
  };

  console.log('-> SELECT families WHERE parent_user_id = auth.uid() (PostgREST under user JWT)');
  const famRes = await fetch(`${url}/rest/v1/families?parent_user_id=eq.${userId}&select=*`, {
    headers: userHeaders,
  });
  const famBody = await famRes.json();
  console.log(`   status=${famRes.status}`);
  console.log(`   body=${JSON.stringify(famBody, null, 2)}`);
  if (famRes.status >= 400 || !Array.isArray(famBody) || famBody.length !== 1) {
    console.error('FAIL at family lookup. Underlying cause is upstream of the kids insert.');
    await cleanup();
    process.exit(1);
  }
  const familyId = famBody[0].id;

  console.log('-> INSERT kids (matches AddKidScreen payload)');
  const insertRes = await fetch(`${url}/rest/v1/kids`, {
    method: 'POST',
    headers: { ...userHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({
      family_id: familyId,
      first_name: 'Reggie',
      last_name: 'Repro',
      age_group: '10U',
      primary_position: 'Shortstop',
    }),
  });
  const insertBody = await insertRes.text();
  console.log(`   status=${insertRes.status}`);
  console.log(`   body=${insertBody}`);
  if (insertRes.status >= 400) {
    console.error('FAIL at kids insert. THIS is the underlying error AddKidScreen was hiding.');
    await cleanup();
    process.exit(1);
  }
  console.log('PASS: kid inserted successfully via the AddKidScreen path.');
} finally {
  await cleanup();
}
