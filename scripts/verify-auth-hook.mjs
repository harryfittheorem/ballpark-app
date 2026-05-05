#!/usr/bin/env node
// =============================================================================
// scripts/verify-auth-hook.mjs
// =============================================================================
// Smoke test for the Custom Access Token Hook on the *remote* Supabase project.
//
// What it does:
//   1. Signs up a throwaway user (random email) with `tenant_slug` in
//      raw_user_meta_data.
//   2. If a session token is returned (email confirmations off), decodes the
//      JWT and asserts `tenant_id`, `family_id`, `role` claims are present.
//      Otherwise signs in with the same credentials to obtain one.
//   3. Reports PASS/FAIL.
//
// Why it exists:
//   Hosted Supabase auth hooks must be enabled in the dashboard
//   (Authentication -> Hooks -> Custom Access Token). The local
//   supabase/config.toml [auth.hook.custom_access_token] block does not always
//   propagate via `supabase db push`. Until the hook is enabled remotely, JWTs
//   will NOT carry tenant_id/family_id/role and every RLS policy that depends
//   on them will silently deny rows.
//
// Required env (read from process.env):
//   EXPO_PUBLIC_SUPABASE_URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY
//
// Usage:
//   node scripts/verify-auth-hook.mjs
//
// Notes:
//   - Uses the auth REST API directly (no @supabase/supabase-js) so it runs in
//     plain Node without needing `ws`.
//   - Leaves the throwaway user in auth.users. Delete via the dashboard or a
//     service-role script if desired.
// =============================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const tenantSlug = process.env.EXPO_PUBLIC_TENANT_SLUG || 'infinitehitting';

if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in env.');
  process.exit(2);
}

const headers = {
  'Content-Type': 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
};

const rand = Math.random().toString(36).slice(2, 10);
const email = `hooktest_${rand}@example.com`;
const password = `Test_${rand}_pw!`;

console.log(`-> signup: ${email}  (tenant_slug=${tenantSlug})`);

const signup = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email,
    password,
    data: { tenant_slug: tenantSlug, first_name: 'Hook', last_name: 'Test' },
  }),
});
const signupBody = await signup.json();

if (signup.status >= 400) {
  console.error(`signup failed (${signup.status}):`, JSON.stringify(signupBody, null, 2));
  process.exit(1);
}

console.log(`   user_id=${signupBody?.user?.id}`);

let token = signupBody?.access_token;
if (!token) {
  console.log('-> signin (email confirmations appear to be on; signing in to mint a token)');
  const signin = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  });
  const signinBody = await signin.json();
  if (signin.status >= 400) {
    console.error(`signin failed (${signin.status}):`, JSON.stringify(signinBody, null, 2));
    console.error('Cannot verify hook claims because no JWT was issued.');
    process.exit(1);
  }
  token = signinBody?.access_token;
}

if (!token) {
  console.error('No access_token returned from either signup or signin.');
  process.exit(1);
}

const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
const claims = {
  tenant_id: payload.tenant_id,
  family_id: payload.family_id,
  role: payload.role,
};

console.log('-> JWT custom claims:', JSON.stringify(claims, null, 2));

const missing = Object.entries(claims)
  .filter(([, v]) => v === undefined || v === null)
  .map(([k]) => k);

if (missing.length > 0) {
  console.error(`FAIL: missing claims: ${missing.join(', ')}`);
  console.error('The Custom Access Token Hook is not registered in the Supabase dashboard.');
  console.error('Fix: Authentication -> Hooks -> Custom Access Token ->');
  console.error('     enable, schema=public, function=custom_access_token_hook.');
  process.exit(1);
}

// Signups go through handle_new_user -> families row -> hook resolves role='parent'.
// If we see anything else (e.g. 'authenticated'), the hook executed but the
// families branch did not match, which is a partial regression worth catching.
if (claims.role !== 'parent') {
  console.error(`FAIL: expected role='parent' for a signup-flow user, got role='${claims.role}'.`);
  console.error('The hook ran but the families lookup did not resolve. Check that:');
  console.error('  1. handle_new_user trigger is installed on auth.users');
  console.error('  2. tenant_slug in raw_user_meta_data matches a row in public.tenants');
  console.error('  3. families.role default / column matches expectations');
  process.exit(1);
}

console.log('PASS: tenant_id, family_id, role=parent all present on the issued JWT.');
console.log('      handle_new_user trigger also fired (family_id resolved).');
