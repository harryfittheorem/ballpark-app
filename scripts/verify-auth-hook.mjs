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
//      Otherwise — when email confirmations are on — uses the service-role
//      admin endpoint to mark the user confirmed, then signs in to mint a
//      JWT and inspect its claims.
//   3. Cleans up by deleting the throwaway user via the admin endpoint when a
//      service-role key is available.
//   4. Reports PASS/FAIL.
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
//   EXPO_PUBLIC_SUPABASE_ANON_KEY  (publishable key for the new key system, or
//                                   legacy anon JWT for projects still on it)
//
// Optional env:
//   SUPABASE_SERVICE_ROLE_KEY      (sb_secret_... on the new key system, or
//                                   legacy service_role JWT). Required when
//                                   the project has email confirmations on —
//                                   without it the script can't mint a JWT
//                                   for the throwaway user and will exit 1
//                                   with an actionable message.
//   HOOK_TEST_EMAIL_DOMAIN         (default: hooksmoketest.dev — pick a
//                                   non-blocklisted, MX-resolvable domain if
//                                   the default ever gets rejected).
//   EXPO_PUBLIC_TENANT_SLUG        (default: infinitehitting)
//
// Usage:
//   node scripts/verify-auth-hook.mjs
//
// Notes:
//   - Uses the auth REST API directly (no @supabase/supabase-js) so it runs in
//     plain Node without needing `ws`.
// =============================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

const adminHeaders = serviceKey
  ? {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    }
  : null;

const rand = Math.random().toString(36).slice(2, 10);
// NOTE: avoid @example.com — Supabase ships a default disposable-domain
// blocklist that rejects it with `email_address_invalid`. Use a domain that
// is not in that list (override with HOOK_TEST_EMAIL_DOMAIN if your project
// blocks this one too).
const emailDomain = process.env.HOOK_TEST_EMAIL_DOMAIN || 'hooksmoketest.dev';
const email = `hooktest_${rand}@${emailDomain}`;
const password = `Test_${rand}_pw!`;

let userId;
let token;

if (adminHeaders) {
  // Preferred path: create the user directly via the admin endpoint with
  // email_confirm=true. This bypasses both email-confirmation requirements and
  // the public-signup email-send rate limiter, so the script is robust against
  // any project-side auth config.
  console.log(`-> admin create user: ${email}  (tenant_slug=${tenantSlug})`);
  const create = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { tenant_slug: tenantSlug, first_name: 'Hook', last_name: 'Test' },
    }),
  });
  const createBody = await create.json();
  if (create.status >= 400) {
    console.error(`admin create failed (${create.status}):`, JSON.stringify(createBody, null, 2));
    process.exit(1);
  }
  userId = createBody?.id || createBody?.user?.id;
  console.log(`   user_id=${userId}`);

  console.log('-> signin to mint JWT');
  const signin = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  });
  const signinBody = await signin.json();
  if (signin.status >= 400) {
    console.error(`signin failed (${signin.status}):`, JSON.stringify(signinBody, null, 2));
    await cleanup();
    process.exit(1);
  }
  token = signinBody?.access_token;
} else {
  // Fallback path: public signup. Works only when email confirmations are off
  // AND the project hasn't recently rate-limited confirmation emails.
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

  userId = signupBody?.user?.id;
  console.log(`   user_id=${userId}`);
  token = signupBody?.access_token;

  if (!token) {
    console.error('FAIL: signup did not return a JWT (email confirmations appear to be on),');
    console.error('      and no SUPABASE_SERVICE_ROLE_KEY is set so the script cannot admin-');
    console.error('      confirm the throwaway user. Provide SUPABASE_SERVICE_ROLE_KEY');
    console.error('      (Project Settings -> API Keys -> "secret", sb_secret_... or legacy');
    console.error('      service_role JWT) and re-run.');
    process.exit(1);
  }
}

if (!token) {
  console.error('No access_token returned from either signup or signin.');
  await cleanup();
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
  await cleanup();
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
  await cleanup();
  process.exit(1);
}

await cleanup();
console.log('PASS: tenant_id, family_id, role all present on the issued JWT.');
console.log(`      (role=${claims.role}; handle_new_user trigger also fired, family_id resolved.)`);

async function cleanup() {
  if (!adminHeaders || !userId) {
    if (userId) {
      console.log(`-> NOTE: leaving throwaway user ${userId} in auth.users (no service-role key to delete).`);
    }
    return;
  }
  const del = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  if (del.status >= 400) {
    const body = await del.text();
    console.warn(`-> WARN: cleanup delete failed (${del.status}): ${body.slice(0, 200)}`);
  } else {
    console.log(`-> cleanup: deleted throwaway user ${userId}`);
  }
}
