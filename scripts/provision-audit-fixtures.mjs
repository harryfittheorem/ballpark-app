#!/usr/bin/env node
// =============================================================================
// scripts/provision-audit-fixtures.mjs
// =============================================================================
// Provisions four dedicated fixture users for the cross-tenant RLS audit
// (task #86, folded-in #85). Idempotent: re-running is a no-op for users
// that already exist; missing kids/families get created on the next pass.
//
//   T1 parent  audit.parent.t1@ballpark.test  (kid auto-attaches to family)
//   T1 coach   audit.coach.t1@ballpark.test
//   T2 parent  audit.parent.t2@ballpark.test
//   T2 coach   audit.coach.t2@ballpark.test
//
// Why dedicated fixtures and not the existing human test accounts?
//   - Human accounts have unknown / rotating passwords.
//   - The audit needs to log in via password and run probes; coupling to
//     real users means every run risks logging real humans out of their
//     sessions and leaking probe rows into their UI.
//   - Dedicated *.ballpark.test addresses make grep + cleanup trivial.
//
// Usage:
//   node scripts/provision-audit-fixtures.mjs <password>
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.argv[2];

if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}
if (!password || password.length < 8) {
  console.error('Usage: node scripts/provision-audit-fixtures.mjs <password>');
  console.error('       password must be at least 8 chars.');
  process.exit(2);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

const T1 = '00000000-0000-0000-0000-000000000001';
const T2 = '00000000-0000-0000-0000-000000000002';

const fixtures = [
  {
    label: 'T1 parent',
    email: 'audit.parent.t1@ballpark.test',
    tenantSlug: 'infinitehitting',
    tenantId: T1,
    role: 'parent',
    metadata: { first_name: 'AuditParent', last_name: 'TenantOne' },
    kid: { first_name: 'AuditKid', last_name: 'TenantOne' },
  },
  {
    label: 'T1 coach',
    email: 'audit.coach.t1@ballpark.test',
    tenantSlug: 'infinitehitting',
    tenantId: T1,
    role: 'coach',
    metadata: { first_name: 'AuditCoach', last_name: 'TenantOne' },
  },
  {
    label: 'T2 parent',
    email: 'audit.parent.t2@ballpark.test',
    tenantSlug: 'test-tenant-two',
    tenantId: T2,
    role: 'parent',
    metadata: { first_name: 'AuditParent', last_name: 'TenantTwo' },
    kid: { first_name: 'AuditKid', last_name: 'TenantTwo' },
  },
  {
    label: 'T2 coach',
    email: 'audit.coach.t2@ballpark.test',
    tenantSlug: 'test-tenant-two',
    tenantId: T2,
    role: 'coach',
    metadata: { first_name: 'AuditCoach', last_name: 'TenantTwo' },
  },
];

async function findUserByEmail(email) {
  // Admin list-users does not support a by-email filter; the `email`
  // query param does a substring match server-side and we still need to
  // disambiguate locally.
  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: adminHeaders },
  );
  const body = await res.json();
  if (res.status >= 400) throw new Error(`list users ${res.status}: ${JSON.stringify(body)}`);
  return (body?.users || []).find((u) => u.email === email) ?? null;
}

async function createUser(fixture) {
  const userMeta = {
    tenant_slug: fixture.tenantSlug,
    ...fixture.metadata,
  };
  if (fixture.role === 'coach') userMeta.app_role = 'coach';

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: fixture.email,
      password,
      email_confirm: true,
      user_metadata: userMeta,
    }),
  });
  const body = await res.json();
  if (res.status >= 400) throw new Error(`create ${fixture.email} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// Run a parameterised SQL statement via the SQL admin endpoint. We do
// this via the supabase-js service-role client because the auth admin
// REST surface doesn't expose arbitrary SQL.
async function adminSql(sql, args = []) {
  // pg-meta isn't available in hosted Supabase; we route via the REST
  // PostgREST surface for table mutations and a small custom RPC for
  // the SELECT we need. To keep things dependency-light we use plain
  // PostgREST + service-role for the kid upsert: family lookup is a
  // straight SELECT on public.families, kid creation is INSERT on
  // public.kids, both with the service role key bypassing RLS.
  void sql; void args;
  throw new Error('adminSql unused — use rest helpers below.');
}

async function rest(method, path, body) {
  const res = await fetch(`${url}/rest/v1${path}`, {
    method,
    headers: {
      ...adminHeaders,
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (res.status >= 400) {
    throw new Error(`REST ${method} ${path} ${res.status}: ${text}`);
  }
  return json;
}

async function ensureFamily(parentUserId, expectedTenantId) {
  const rows = await rest('GET', `/families?parent_user_id=eq.${parentUserId}&select=id,tenant_id`);
  if (!rows || rows.length === 0) {
    throw new Error(`family not found for parent_user_id=${parentUserId} — handle_new_user trigger may have failed`);
  }
  const fam = rows[0];
  if (fam.tenant_id !== expectedTenantId) {
    throw new Error(`family ${fam.id} has tenant_id=${fam.tenant_id}, expected ${expectedTenantId}`);
  }
  return fam.id;
}

async function ensureKid(familyId, kid) {
  const rows = await rest(
    'GET',
    `/kids?family_id=eq.${familyId}&first_name=eq.${encodeURIComponent(kid.first_name)}&last_name=eq.${encodeURIComponent(kid.last_name)}&select=id`,
  );
  if (rows && rows.length > 0) return rows[0].id;
  const created = await rest('POST', '/kids', {
    family_id: familyId,
    first_name: kid.first_name,
    last_name: kid.last_name,
    age_group: '11U',
    primary_position: 'CF',
  });
  return created[0].id;
}

const results = [];
for (const f of fixtures) {
  let user = await findUserByEmail(f.email);
  if (user) {
    console.log(`[skip] ${f.label}: ${f.email} already exists (user_id=${user.id})`);
  } else {
    console.log(`[new ] ${f.label}: creating ${f.email}`);
    user = await createUser(f);
    console.log(`       user_id=${user.id}`);
  }

  const entry = { label: f.label, email: f.email, userId: user.id, tenantId: f.tenantId };

  if (f.role === 'parent') {
    const familyId = await ensureFamily(user.id, f.tenantId);
    const kidId = await ensureKid(familyId, f.kid);
    entry.familyId = familyId;
    entry.kidId = kidId;
    console.log(`       family_id=${familyId}  kid_id=${kidId}`);
  }

  results.push(entry);
}

console.log('\n=== Fixtures summary (machine-readable JSON below) ===');
console.log(JSON.stringify(results, null, 2));
