#!/usr/bin/env node
// Sign in and decode the JWT to inspect custom claims (tenant_id, family_id, role).
// Usage: node scripts/check-jwt.mjs <email> <password>
// Uses the auth REST API directly (no SDK) so it runs in plain Node.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in env.');
  process.exit(2);
}

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/check-jwt.mjs <email> <password>');
  process.exit(2);
}

const headers = {
  'Content-Type': 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
};

console.log(`-> signin as ${email}`);
const signin = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password }),
});
const body = await signin.json();
if (signin.status >= 400) {
  console.error(`signin failed (${signin.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}

const token = body?.access_token;
if (!token) {
  console.error('No access_token in response:', JSON.stringify(body, null, 2));
  process.exit(1);
}

const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
console.log('\nFull JWT payload:');
console.log(JSON.stringify(payload, null, 2));

console.log('\nKey claims:');
console.log('  sub (auth user id):', payload.sub);
console.log('  tenant_id:        ', payload.tenant_id);
console.log('  family_id:        ', payload.family_id);
console.log('  role:             ', payload.role);

const missing = ['tenant_id', 'family_id', 'role'].filter((k) => payload[k] == null);
if (missing.length) {
  console.log(`\nFAIL: missing claims: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('\nPASS: all custom claims present.');
