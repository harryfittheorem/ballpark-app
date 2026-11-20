// Offline integration tests: run the real portal/mobile handlers and billing
// function, replacing only Supabase/Stripe/Resend I/O. No live data or payments.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { randomUUID, webcrypto } = require('node:crypto');

const tenant = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const locationId = '44444444-4444-4444-8444-444444444444';
const waiverId = '55555555-5555-4555-8555-555555555555';
const staffId = '66666666-6666-4666-8666-666666666666';
// Match the database contract, rather than silently accepting invented columns.
// Location belongs to families; kids inherit it through their family_id.
const enrollmentWriteColumns = {
  families: new Set(('id tenant_id primary_location_id parent_user_id parent_first_name parent_last_name parent_phone parent_email '
    + 'stripe_customer_id role created_at updated_at card_last4 card_brand card_exp_month card_exp_year stripe_connected_customer_id').split(' ')),
  kids: new Set(('id family_id first_name last_name date_of_birth age_group primary_position jersey_number avatar_url '
    + 'points_balance current_streak_days created_at updated_at').split(' ')),
  family_waivers: new Set('id family_id waiver_id signed_at app_version ip_address signature_image_path'.split(' ')),
  memberships: new Set(('id tenant_id family_id kid_id plan_name plan_type status amount_cents billing_anchor_day stripe_subscription_id '
    + 'started_at cancelled_at created_at updated_at pause_start pause_end paused_at cancel_requested_at cancel_effective_at '
    + 'sessions_total sessions_remaining next_billing_at contract_url sessions_per_week weekly_sessions_used weekly_period_start '
    + 'payment_failed_at stripe_price_id cancel_at payment_failure_count payment_pause_scheduled_at payment_paused_reason expires_at '
    + 'staff_enrollment_request_id').split(' ')),
};
class NextResponse extends Response {
  static json(body, init) { return new NextResponse(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }); }
}
class NextRequest extends Request {
  get nextUrl() { return new URL(this.url); }
}
let db, users, intents, customers, subscriptions, prices, idempotency, env, calls, failures, modules, edgeHandler, cookieSession, otpUser;
const token = (role = 'owner', tenantId = tenant, userId = staffId) =>
  `verified.${Buffer.from(JSON.stringify({ app_role: role, tenant_id: tenantId, sub: userId })).toString('base64url')}.signature`;
const session = (access_token = token()) => ({ access_token, user: { id: staffId } });
const json = (body, status = 200) => NextResponse.json(body, { status });

function relation(row, table, selection) {
  const result = { ...row };
  if (table === 'memberships' && selection.includes('families')) {
    result.families = db.families.find(f => f.id === row.family_id);
    if (selection.includes('kids(')) result.kids = db.kids.find(k => k.id === row.kid_id);
  }
  return result;
}
class Query {
  constructor(table, access = 'service') { this.table = table; this.access = access; this.filters = []; this.mode = 'read'; this.selection = ''; this.one = false; }
  select(selection = '*') { this.selection = selection; return this; }
  eq(k, v) { this.filters.push(r => k === 'families.primary_location_id'
    ? db.families.find(f => f.id === r.family_id)?.primary_location_id === v : r[k] === v); return this; }
  neq(k, v) { this.filters.push(r => r[k] !== v); return this; }
  not(k, _op, v) { this.filters.push(r => r[k] != v); return this; }
  or() { this.filters.push(r => !r.locked_until || new Date(r.locked_until) < new Date()); return this; }
  order() { return this; }
  limit(n) { this.max = n; return this; }
  insert(value) { this.mode = 'insert'; this.value = value; return this; }
  update(value) { this.mode = 'update'; this.value = value; return this; }
  single() { this.one = true; return this.run(); }
  maybeSingle() { this.one = true; return this.run(); }
  then(resolve, reject) { return this.run().then(resolve, reject); }
  async run() {
    if (this.access === 'authenticated' && this.mode !== 'read' && ['memberships', 'payment_events'].includes(this.table)) {
      calls.deniedBillingWrites = (calls.deniedBillingWrites ?? 0) + 1;
      return { data: null, error: { code: '42501', message: `permission denied for table ${this.table}` } };
    }
    if (this.mode !== 'read' && enrollmentWriteColumns[this.table]) {
      const unknownColumn = Object.keys(this.value).find(column => !enrollmentWriteColumns[this.table].has(column));
      if (unknownColumn) return { data: null, error: {
        code: 'PGRST204', message: `Could not find the '${unknownColumn}' column of '${this.table}' in the schema cache`,
      } };
    }
    const failure = failures.find(f => f.table === this.table && f.mode === this.mode && f.remaining > 0 &&
      (!f.field || Object.hasOwn(this.value ?? {}, f.field)));
    if (failure) { failure.remaining--; return { data: null, error: { code: failure.code ?? 'test_error', message: failure.message ?? 'Simulated database interruption' } }; }
    const table = db[this.table] ?? (db[this.table] = []);
    let rows = table.filter(r => this.filters.every(f => f(r)));
    if (this.mode === 'insert') {
      const value = { id: randomUUID(), ...this.value };
      if (this.table === 'staff_enrollment_requests') {
        if (table.some(r => r.id === value.id)) return { data: null, error: { code: '23505' } };
        Object.assign(value, { parent_user_id: randomUUID(), completed: false, intent: null, billing_intent: null, operation_lock: null, locked_until: null });
      }
      table.push(value);
      rows = [value];
    }
    if (this.mode === 'update') rows.forEach(r => Object.assign(r, this.value));
    if (this.max) rows = rows.slice(0, this.max);
    const values = rows.map(r => relation(r, this.table, this.selection));
    return { data: this.one ? values[0] ?? null : values, error: null };
  }
}
const service = {
  from: table => new Query(table),
  auth: { admin: { getUserById: async id => ({ data: { user: users.find(u => u.id === id) } }) } },
};
function callerClient(_url, key, options) {
  if (key === 'service-fixture') return service;
  const headerToken = options?.global?.headers?.Authorization?.replace('Bearer ', '');
  return {
    from: table => new Query(table, 'authenticated'),
    auth: {
      getUser: async supplied => {
        const accessToken = supplied ?? headerToken;
        if (!accessToken?.startsWith('verified.')) return { data: { user: null }, error: new Error('Invalid token') };
        const claims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
        return { data: { user: { id: claims.sub, user_metadata: { app_role: calls.userMetadataRole ?? 'parent' }, app_metadata: {} } }, error: null };
      },
      getSession: async () => ({ data: { session: cookieSession } }),
      refreshSession: async () => {
        calls.sessionRefreshes = (calls.sessionRefreshes ?? 0) + 1;
        if (calls.sessionRefreshFails) return { data: { session: cookieSession }, error: new Error('Network failure') };
        if (calls.refreshedAccessToken) cookieSession = session(calls.refreshedAccessToken);
        return { data: { session: cookieSession }, error: null };
      },
      verifyOtp: async ({ token_hash, type }) => {
        if (token_hash !== 'a'.repeat(64) || type !== 'recovery' || !users.length) return { data: {}, error: new Error('Expired') };
        otpUser = users[0];
        return { data: { user: otpUser } };
      },
      updateUser: async ({ password }) => { otpUser.password = password; return { error: null }; },
      signOut: async () => ({ error: null }),
    },
  };
}

function load(relative) {
  const file = path.resolve(__dirname, '..', relative);
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  modules.set(file, exports);
  const mockedRequire = name => {
    if (name === 'next/server') return { NextRequest, NextResponse };
    if (name === '@supabase/supabase-js' || name === 'npm:@supabase/supabase-js@2') return { createClient: callerClient };
    if (name === '@/lib/supabase/serviceClient') return { createServiceClient: () => service };
    if (name === '@/lib/supabase/server') return { createClient: async () => callerClient() };
    if (name === '@/lib/supabase') return { supabase: callerClient() };
    if (name === '@/lib/email') return { buildEmailSender: () => ({}), sendResendEmail: async args => { calls.emails.push(args); return { ok: true }; } };
    if (name.startsWith('@/')) return load(`portal/${name.slice(2)}.ts`);
    return require(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', 'process', 'fetch', 'crypto', 'Deno', compiled)(
    mockedRequire, exports, { env }, fakeFetch, webcrypto,
    { env: { get: name => env[name] }, serve: handler => { edgeHandler = handler; } },
  );
  return exports;
}
async function fakeFetch(url, init = {}) {
  url = String(url);
  const method = init.method ?? 'GET';
  calls.http.push({ url, method, headers: init.headers, body: init.body });
  if (url.startsWith('https://portal.fixture/api/mobile/enroll')) {
    const suffix = new URL(url).pathname.replace('/api/mobile/enroll', '');
    const handler = load(`portal/app/api/mobile/enroll${suffix}/route.ts`);
    return handler[method](new NextRequest(url, init));
  }
  if (url.includes('/functions/v1/stripe-create-subscription')) {
    load('supabase/functions/stripe-create-subscription/index.ts');
    return edgeHandler(new Request(url, init));
  }
  if (url.includes('/auth/v1/admin/generate_link')) return json({ hashed_token: 'a'.repeat(64), action_link: 'https://incorrect-site.example' });
  if (url.includes('/auth/v1/admin/users')) {
    if (method === 'GET') return json({ users: calls.hideListedUsers ? [] : users });
    if (method === 'DELETE') {
      if (calls.failAuthDelete) return json({ error: 'Simulated cleanup interruption' }, 503);
      const id = url.split('/').pop();
      users = users.filter(user => user.id !== id);
      db.families = db.families.filter(f => f.parent_user_id !== id);
      return json({});
    }
    const body = JSON.parse(init.body);
    if (users.some(u => u.email === body.email)) return json({ msg: 'User already registered' }, 422);
    const user = { id: randomUUID(), ...body };
    users.push(user);
    db.families.push({ id: randomUUID(), parent_user_id: user.id, tenant_id: tenant });
    if (calls.failAuthAfterCreation) {
      calls.failAuthAfterCreation = false;
      throw new Error('Simulated lost Auth success response');
    }
    return json(user);
  }
  if (url.includes('/storage/v1/object/')) return json({ ok: true });
  if (!url.startsWith('https://api.stripe.com/v1/')) throw new Error(`Unexpected HTTP ${url}`);
  const route = new URL(url).pathname.replace('/v1/', '');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('Stripe-Account'), 'acct_fixture', 'payment must remain on selected location');
  const key = headers.get('Idempotency-Key');
  if (key && idempotency.has(key)) return json(idempotency.get(key));
  const form = new URLSearchParams(init.body);
  let result;
  if (['setup_intents', 'payment_intents'].includes(route) && method === 'POST') {
    const id = `${route === 'setup_intents' ? 'seti' : 'pi'}_${randomUUID().replaceAll('-', '')}`;
    result = { id, client_secret: `${id}_secret_fixture`, status: 'requires_payment_method',
      metadata: { membership_id: form.get('metadata[membership_id]') },
      amount: Number(form.get('amount')), payment_method: { id: 'pm_fixture', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } } };
    intents.set(id, result);
  } else if (/^(setup_intents|payment_intents)\/[^/]+$/.test(route)) {
    result = intents.get(route.split('/')[1]);
    if (!result) return json({ error: { message: 'Intent missing' } }, 404);
    if (method === 'POST' && form.has('setup_future_usage')) result.setup_future_usage = form.get('setup_future_usage');
  } else if (route === 'customers' && method === 'POST') {
    result = { id: `cus_${customers.size + 1}` }; customers.set(result.id, result);
  } else if (/^customers\/[^/]+\/payment_methods$/.test(route)) result = { data: [{ id: 'pm_fixture' }] };
  else if (/^customers\//.test(route) || route.startsWith('payment_methods/')) result = { id: route.split('/')[1] };
  else if (route === 'prices' && method === 'POST') {
    result = { id: `price_${prices.size + 1}`, active: true }; prices.set(result.id, result);
  } else if (route.startsWith('prices/')) result = prices.get(route.split('/')[1]);
  else if (route === 'subscriptions' && method === 'GET') result = { data: [...subscriptions.values()] };
  else if (route === 'subscriptions' && method === 'POST') {
    const invoiceIntentId = `pi_invoice_${subscriptions.size + 1}`;
    const invoiceIntent = {
      id: invoiceIntentId, client_secret: `${invoiceIntentId}_secret_fixture`,
      status: calls.invoiceStatus ?? 'succeeded',
      payment_method: { id: 'pm_fixture', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
    };
    intents.set(invoiceIntentId, invoiceIntent);
    result = { id: `sub_${subscriptions.size + 1}`, status: calls.subscriptionStatus ?? 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      metadata: { membership_id: form.get('metadata[membership_id]') },
      latest_invoice: { id: 'in_fixture', payment_intent: invoiceIntent } };
    subscriptions.set(result.id, result);
  } else if (route.startsWith('subscriptions/')) result = subscriptions.get(route.split('/')[1]);
  else throw new Error(`Unexpected Stripe route ${route}`);
  if (key) idempotency.set(key, structuredClone(result));
  return json(result);
}

beforeEach(() => {
  db = {
    tenants: [{ id: tenant, slug: 'academy', name: 'Academy', royalty_config: {} }],
    membership_plans: [{ id: planId, tenant_id: tenant, is_active: true, name: 'Training', plan_type: 'otc', amount_cents: 12000 }],
    locations: [{ id: locationId, tenant_id: tenant, name: 'Home', stripe_account_id: 'acct_fixture', stripe_onboarding_status: 'connected' }],
    waivers: [{ id: waiverId, tenant_id: tenant, is_active: true, version: 2, body_text: 'Current waiver' }],
    families: [], kids: [], memberships: [], family_waivers: [], staff_enrollment_requests: [], payment_events: [],
  };
  users = []; intents = new Map(); customers = new Map(); subscriptions = new Map(); prices = new Map(); idempotency = new Map();
  calls = { http: [], emails: [] }; failures = []; modules = new Map(); cookieSession = session(); otpUser = null;
  env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.fixture', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-fixture',
    SUPABASE_URL: 'https://supabase.fixture', SUPABASE_ANON_KEY: 'anon-fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'service-fixture', STRIPE_SECRET_KEY: 'stripe-fixture',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_fixture', RESEND_API_KEY: 'resend-fixture',
    EXPO_PUBLIC_PORTAL_URL: 'https://portal.fixture',
  };
});
const payload = () => ({
  request_id: randomUUID(), parent_first_name: 'New', parent_last_name: 'Parent',
  parent_email: 'new.parent@example.test', parent_phone: '5550100',
  kid_first_name: 'Athlete', kid_last_name: 'Parent', age_group: '12U',
  location_id: locationId, plan_id: planId, waiver_id: waiverId,
  signature_image_data: `data:image/png;base64,${Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(150, 4)]).toString('base64')}`,
});
async function mobile(suffix = '', body, accessToken = token()) {
  const handler = load(`portal/app/api/mobile/enroll${suffix}/route.ts`);
  const req = new NextRequest(`https://portal.fixture/api/mobile/enroll${suffix}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return (body === undefined ? handler.GET : handler.POST)(req);
}
async function created() {
  const response = await mobile('', payload());
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
async function prepared() {
  const family = await created();
  const response = await mobile('/setup-intent', { membership_id: family.membership_id });
  assert.equal(response.status, 200, await response.clone().text());
  const intent = await response.json();
  return { family, intent, complete: { family_id: family.family_id, membership_id: family.membership_id, stripe_intent_id: intent.client_secret.split('_secret_')[0] } };
}

test('owner and admin can load only their tenant options; parent, coach, super-admin, forged and missing tokens are rejected', async () => {
  assert.equal((await mobile()).status, 200);
  assert.equal((await mobile('', undefined, token('admin'))).status, 200);
  for (const role of ['parent', 'coach', 'super_admin']) {
    assert.equal((await mobile('', undefined, token(role))).status, 403);
    assert.equal((await mobile('', payload(), token(role))).status, 403);
    assert.equal((await mobile('/setup-intent', {}, token(role))).status, 403);
    assert.equal((await mobile('/attach-payment', {}, token(role))).status, 403);
  }
  assert.equal((await mobile('', undefined, token('owner', null))).status, 403);
  assert.equal((await mobile('', undefined, 'forged.token.signature')).status, 401);
  assert.equal((await mobile('', undefined, null)).status, 401);
  assert.equal(db.families.length, 0);
});

test('creation links parent, athlete, active waiver and pending membership; replay returns same records', async () => {
  const body = payload();
  const first = await mobile('', body);
  assert.equal(first.status, 200, await first.clone().text());
  const result = await first.json();
  assert.deepEqual(await (await mobile('', body)).json(), result);
  assert.equal(users.length, 1);
  assert.equal(users[0].email_confirm, true);
  assert.equal(users[0].user_metadata.app_role, 'parent');
  assert.equal(db.families[0].primary_location_id, locationId);
  assert.equal(db.kids[0].family_id, result.family_id);
  assert.equal(Object.hasOwn(db.kids[0], 'primary_location_id'), false);
  assert.equal(db.family_waivers[0].waiver_id, waiverId);
  assert.equal(db.family_waivers[0].app_version, 'mobile-staff');
  assert.equal(db.memberships[0].status, 'pending_enrollment');
  assert.equal(db.memberships[0].kid_id, result.kid_id);
  assert.equal(db.memberships[0].staff_enrollment_request_id, body.request_id);
  assert.equal((await mobile('', { ...body, parent_first_name: 'Changed' })).status, 409);
});

test('database doubles reject nonexistent columns instead of masking schema mismatches', async () => {
  for (const table of Object.keys(enrollmentWriteColumns)) {
    const column = table === 'kids' ? 'primary_location_id' : 'nonexistent_column';
    const { error } = await service.from(table).insert({ [column]: locationId });
    assert.equal(error.code, 'PGRST204');
    assert.match(error.message, new RegExp(column));
    assert.equal(db[table].length, 0);
  }
});

test('retry after the athlete schema error resumes the same request and reserved account without duplicates', async () => {
  const body = payload();
  failures.push({ table: 'kids', mode: 'insert', remaining: 1, code: 'PGRST204',
    message: "Could not find the 'primary_location_id' column of 'kids' in the schema cache" });
  const failed = await mobile('', body);
  assert.equal(failed.status, 500);
  assert.match((await failed.json()).error, /primary_location_id/);
  const reservedParent = db.staff_enrollment_requests[0].parent_user_id;
  assert.equal(db.staff_enrollment_requests.length, 1);
  assert.equal(users.length, 0, 'failed create cleans up the first Auth account');
  assert.equal(db.kids.length, 0);
  assert.equal(db.memberships.length, 0);
  assert.equal(intents.size, 0, 'payment has not started');
  const retried = await mobile('', body);
  assert.equal(retried.status, 200, await retried.clone().text());
  const result = await retried.json();
  assert.equal(users[0].id, reservedParent);
  assert.equal(db.families[0].primary_location_id, body.location_id);
  assert.equal(db.kids[0].family_id, result.family_id);
  assert.equal(Object.hasOwn(db.kids[0], 'primary_location_id'), false);
  assert.deepEqual(await (await mobile('', body)).json(), result);
  assert.equal(users.length, 1);
  assert.equal(db.families.length, 1);
  assert.equal(db.kids.length, 1);
  assert.equal(db.family_waivers.length, 1);
  assert.equal(db.memberships.length, 1);
  assert.equal(db.staff_enrollment_requests.length, 1);
});

test('UUID validation accepts canonical database identifiers without assuming their generation version', () => {
  const { isUuid } = load('portal/lib/mobileEnrollment.ts');
  for (const id of [
    '71500000-0000-0000-0000-000000000000',
    '71500000-0000-0000-0000-000000000001',
    '019b1b20-0000-7000-8000-000000000001',
    'aaaaaaaa-bbbb-8ccc-9ddd-eeeeeeeeeeee',
    planId,
  ]) assert.equal(isUuid(id), true, id);
  for (const id of ['', 'not-a-plan', `${planId}extra`, planId.replace('-', ''), null, {}, 123]) {
    assert.equal(isUuid(id), false);
  }
});

for (const planType of ['eft', 'otc']) {
  test(`existing seeded plan IDs can complete ${planType} enrollment without changing database IDs`, async () => {
    const plan = '71500000-0000-0000-0000-000000000000';
    const location = '71600000-0000-0000-0000-000000000001';
    const waiver = '71700000-0000-0000-0000-000000000001';
    db.membership_plans[0].id = plan;
    db.membership_plans[0].plan_type = planType;
    db.locations[0].id = location;
    db.waivers[0].id = waiver;
    const options = await (await mobile()).json();
    assert.equal(options.plans[0].id, plan);
    const body = { ...payload(), plan_id: plan, location_id: location, waiver_id: waiver,
      request_id: '019b1b20-0000-7000-8000-000000000001' };
    const createdResponse = await mobile('', body);
    assert.equal(createdResponse.status, 200, await createdResponse.clone().text());
    const result = await createdResponse.json();
    assert.equal(users.length, 1);
    assert.equal(db.families[0].primary_location_id, location);
    assert.equal(db.kids[0].family_id, result.family_id);
    assert.equal(Object.hasOwn(db.kids[0], 'primary_location_id'), false);
    const setup = await mobile('/setup-intent', { membership_id: result.membership_id });
    assert.equal(setup.status, 200);
    const intent = await setup.json();
    const intentId = intent.client_secret.split('_secret_')[0];
    intents.get(intentId).status = 'succeeded';
    const complete = { family_id: result.family_id, membership_id: result.membership_id, stripe_intent_id: intentId };
    assert.equal((await mobile('/attach-payment', complete)).status, 200);
    assert.equal(db.memberships[0].status, 'active');
    assert.equal(db.family_waivers[0].waiver_id, waiver);
    assert.deepEqual(await (await mobile('', body)).json(), result);
    assert.equal((await mobile('/attach-payment', complete)).status, 200);
    assert.equal(users.length, 1);
    assert.equal(db.memberships.length, 1);
  });
}

test('duplicate email and invalid/inactive/foreign plan, waiver or location cannot create families', async () => {
  users.push({ id: randomUUID(), email: payload().parent_email });
  assert.equal((await mobile('', payload())).status, 409);
  users = [];
  for (const table of ['membership_plans', 'waivers', 'locations']) {
    const original = structuredClone(db[table][0]);
    db[table][0].tenant_id = otherTenant;
    assert.ok((await mobile('', payload())).status >= 400, table);
    db[table][0] = original;
  }
  db.waivers[0].is_active = false;
  assert.equal((await mobile('', payload())).status, 404);
  db.waivers[0].is_active = true;
  db.locations[0].stripe_onboarding_status = 'pending';
  assert.equal((await mobile('', payload())).status, 422);
  assert.equal(users.length, 0);
  assert.equal(db.memberships.length, 0);
  assert.equal((await mobile('', { ...payload(), signature_image_data: 'data:image/png;base64,YmFk' })).status, 422);
});

test('optional athlete age and contact fields are stored as null, not invalid empty strings', async () => {
  const response = await mobile('', { ...payload(), age_group: '', kid_last_name: '', parent_phone: '' });
  assert.equal(response.status, 200);
  assert.equal(db.kids[0].age_group, null, 'empty age would violate the database age-group check');
  assert.equal(db.kids[0].last_name, null);
  assert.equal(db.families[0].parent_phone, null);
});

test('OTC payment failure is not completion; successful full payment activates exactly once and can recover after lost sheet callback', async () => {
  const { family, intent, complete } = await prepared();
  assert.equal(intent.intent_type, 'payment');
  assert.equal((await mobile('/attach-payment', complete)).status, 422);
  assert.equal(db.memberships[0].status, 'pending_enrollment');
  assert.equal(calls.emails.length, 0);
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  const status = await (await mobile('/setup-intent', { membership_id: family.membership_id })).json();
  assert.equal(status.payment_confirmed, true);
  assert.equal((await mobile('/attach-payment', complete)).status, 200);
  assert.equal(db.memberships[0].status, 'active');
  assert.equal(db.payment_events.length, 1);
  assert.equal(db.payment_events[0].amount_cents, 12000);
  assert.equal(calls.emails.length, 1);
  assert.match(calls.emails[0].html, /auth\/enrollment-password\?token_hash=/);
  assert.equal((await mobile('/attach-payment', complete)).status, 200);
  assert.equal(db.payment_events.length, 1);
  assert.equal(calls.emails.length, 1);
  assert.equal(db.memberships[0].family_id, family.family_id, 'portal reads the same membership row');
});

test('EFT uses existing billing function, signed role claims and one subscription across retries', async () => {
  db.membership_plans[0].plan_type = 'eft';
  const { intent, complete } = await prepared();
  assert.equal(intent.intent_type, 'setup');
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  assert.equal((await mobile('/attach-payment', complete)).status, 200);
  assert.equal(subscriptions.size, 1);
  assert.equal(db.memberships[0].status, 'active');
  assert.ok(db.memberships[0].stripe_subscription_id);
  assert.equal((await mobile('/attach-payment', complete)).status, 200);
  assert.equal(subscriptions.size, 1);
  assert.equal(customers.size, 1);
});

test('declined first EFT billing stays recoverable on the original invoice without sending a welcome email', async () => {
  db.membership_plans[0].plan_type = 'eft';
  calls.subscriptionStatus = 'incomplete';
  calls.invoiceStatus = 'requires_payment_method';
  const { complete } = await prepared();
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  assert.equal((await mobile('/attach-payment', complete)).status, 402);
  assert.equal(db.memberships[0].status, 'payment_overdue');
  assert.equal(db.staff_enrollment_requests[0].completed, false);
  assert.equal(calls.emails.length, 0);
  assert.equal((await mobile('/attach-payment', complete)).status, 402);
  assert.equal(subscriptions.size, 1, 'decline retry must not start a second subscription');
});

test('cross-tenant/staff payment, mismatched family and intent substitution are rejected', async () => {
  const { complete } = await prepared();
  assert.equal((await mobile('/attach-payment', complete, token('owner', otherTenant))).status, 404);
  assert.equal((await mobile('/attach-payment', complete, token('owner', tenant, randomUUID()))).status, 404);
  assert.equal((await mobile('/attach-payment', { ...complete, family_id: randomUUID() })).status, 403);
  assert.equal((await mobile('/attach-payment', { ...complete, stripe_intent_id: 'pi_other' })).status, 422);
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  intents.get(complete.stripe_intent_id).metadata.membership_id = randomUUID();
  assert.equal((await mobile('/attach-payment', complete)).status, 422);
  assert.equal((await mobile('/setup-intent', { membership_id: complete.membership_id, deferred: true })).status, 422);
  assert.equal((await mobile('/attach-payment', { ...complete, split_deposit_cents: 100 })).status, 422);
});

test('transient payment activation failure can be retried without a new payment or family', async () => {
  const { complete } = await prepared();
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  failures.push({ table: 'memberships', mode: 'update', remaining: 1 });
  assert.equal((await mobile('/attach-payment', complete)).status, 500);
  assert.equal(db.memberships[0].status, 'pending_enrollment');
  assert.equal((await mobile('/attach-payment', complete)).status, 200);
  assert.equal(users.length, 1);
  assert.equal(intents.size, 1);
  assert.equal(db.payment_events.length, 1);
});

test('request lock prevents concurrent enrollment and payment operations', async () => {
  const body = payload();
  const response = await mobile('', body);
  const family = await response.json();
  db.staff_enrollment_requests[0].locked_until = new Date(Date.now() + 60_000).toISOString();
  assert.equal((await mobile('', body)).status, 409);
  assert.equal((await mobile('/setup-intent', { membership_id: family.membership_id })).status, 409);
  assert.equal(db.memberships.length, 1);
});

test('cookie-based portal enrollment still creates the same linked records', async () => {
  const handler = load('portal/app/api/owner/enroll/route.ts');
  const response = await handler.POST(new NextRequest('https://portal.fixture/api/owner/enroll', {
    method: 'POST', body: JSON.stringify(payload()),
  }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(db.memberships[0].status, 'active', 'legacy portal status behavior stays unchanged');
  assert.equal(db.family_waivers[0].app_version, 'portal-kiosk');
  assert.equal(db.memberships[0].staff_enrollment_request_id, undefined);
});

test('parent password proof sets a usable password without replacing staff session', async () => {
  await created();
  const handler = load('portal/app/api/auth/enrollment-password/route.ts');
  const req = body => new NextRequest('https://portal.fixture/api/auth/enrollment-password', { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await handler.POST(req({ token_hash: 'b'.repeat(64), password: 'strong-parent-password' }))).status, 422);
  assert.equal((await handler.POST(req({ token_hash: 'a'.repeat(64), password: 'strong-parent-password' }))).status, 200);
  assert.equal(users[0].password, 'strong-parent-password');
  assert.equal(cookieSession.user.id, staffId);
});

test('native API sends the staff access token, retains the request ID and exposes retryable status', async () => {
  const api = load('src/api/staffEnrollment.ts');
  assert.equal(api.canEnrollStaff(token()), true);
  assert.equal(api.canEnrollStaff(token('super_admin')), false);
  assert.equal(api.canEnrollStaff(token('coach')), false);
  const body = payload();
  const requestId = body.request_id;
  delete body.request_id;
  const first = await api.createStaffEnrollment(body, requestId);
  assert.deepEqual(await api.createStaffEnrollment(body, requestId), first);
  assert.equal(users.length, 1);
  await assert.rejects(() => api.createStaffEnrollment(body, randomUUID()),
    error => error instanceof api.EnrollmentApiError && error.status === 409);
  cookieSession = session(token('parent'));
  await assert.rejects(() => api.getEnrollmentOptions(), /Owner or admin access/);
});

test('an owner can discover enrollment with stale tenant claims but cannot use it before access refresh', async () => {
  const api = load('src/api/staffEnrollment.ts');
  cookieSession = session(token('owner', null));
  assert.equal(api.hasStaffEnrollmentRole(cookieSession.access_token), true);
  assert.equal(api.canEnrollStaff(cookieSession.access_token), false);
  await assert.rejects(() => api.getEnrollmentOptions(), /Owner or admin access/);
  calls.refreshedAccessToken = token('owner');
  await api.refreshStaffEnrollmentAccess();
  assert.equal(calls.sessionRefreshes, 1);
  assert.equal(api.canEnrollStaff(cookieSession.access_token), true);
  assert.equal((await api.getEnrollmentOptions()).plans.length, 1);
});

test('refreshing enrollment access never elevates coaches, parents or HQ-only admins', async () => {
  const api = load('src/api/staffEnrollment.ts');
  for (const role of ['coach', 'parent', 'super_admin']) {
    cookieSession = session(token(role));
    assert.equal(api.hasStaffEnrollmentRole(cookieSession.access_token), false);
    await assert.rejects(() => api.refreshStaffEnrollmentAccess(), /requires a location owner or tenant admin/);
    await assert.rejects(() => api.getEnrollmentOptions(), /Owner or admin access/);
  }
  cookieSession = session(token('admin', null));
  await assert.rejects(() => api.refreshStaffEnrollmentAccess(), /missing business access/);
  assert.equal(api.canEnrollStaff(cookieSession.access_token), false);
});

test('failed enrollment access refresh is recoverable without discarding the saved login', async () => {
  const api = load('src/api/staffEnrollment.ts');
  const saved = cookieSession;
  calls.sessionRefreshFails = true;
  await assert.rejects(() => api.refreshStaffEnrollmentAccess(), /Check your connection/);
  assert.equal(cookieSession, saved);
  calls.sessionRefreshFails = false;
  await api.refreshStaffEnrollmentAccess();
  cookieSession = null;
  await assert.rejects(() => api.refreshStaffEnrollmentAccess(), /session has expired/);
});

test('the actual auth subscriber releases the session lock before push registration reads the session', async () => {
  const file = path.resolve(__dirname, '../src/hooks/useAuth.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let subscriber;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'supabase.auth.onAuthStateChange') subscriber = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(subscriber, 'useAuth must subscribe to session changes');
  const compiled = ts.transpileModule(`exports.callback = ${subscriber.getText(source)};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const timers = [];
  let lockHeld = true;
  let registered = 0;
  let currentSession;
  new Function('exports', 'setSession', 'registerForPushNotifications', 'mounted', 'setTimeout', 'console', compiled)(
    exports, value => { currentSession = value; },
    async () => { assert.equal(lockHeld, false, 'nested session lookup would deadlock Auth'); registered++; },
    true, callback => { timers.push(callback); }, { warn: () => assert.fail('Unexpected push registration error') },
  );
  const staffSession = session();
  assert.equal(exports.callback('SIGNED_IN', staffSession), undefined, 'Auth must not await registration');
  assert.equal(currentSession, staffSession);
  assert.equal(registered, 0);
  lockHeld = false;
  timers.shift()();
  assert.equal(registered, 1);
  exports.callback('TOKEN_REFRESHED', staffSession);
  assert.equal(timers.length, 0, 'refreshing enrollment claims must not queue another push registration');
});

test('lost intent-save response reuses the same Stripe intent on retry', async () => {
  const family = await created();
  failures.push({ table: 'staff_enrollment_requests', mode: 'update', field: 'intent', remaining: 1 });
  assert.equal((await mobile('/setup-intent', { membership_id: family.membership_id })).status, 500);
  assert.equal(intents.size, 1);
  assert.equal((await mobile('/setup-intent', { membership_id: family.membership_id })).status, 200);
  assert.equal(intents.size, 1);
});

test('Auth account created before a lost response is resumed by reserved ID, not rejected as a duplicate', async () => {
  const body = payload();
  calls.failAuthAfterCreation = true;
  assert.equal((await mobile('', body)).status, 500);
  assert.equal(users.length, 1);
  assert.equal(db.families.length, 1);
  assert.equal(db.memberships.length, 0);
  const reservedId = db.staff_enrollment_requests[0].parent_user_id;
  assert.equal(users[0].id, reservedId);
  assert.equal(users[0].app_metadata.staff_enrollment_request_id, body.request_id);
  const retried = await mobile('', body);
  assert.equal(retried.status, 200, await retried.clone().text());
  assert.equal(users.length, 1);
  assert.equal(db.families.length, 1);
  assert.equal(db.kids.length, 1);
  assert.equal(db.family_waivers.length, 1);
  assert.equal(db.memberships.length, 1);
});

test('Auth duplicate-email rejection remains clear when the listing omits that account', async () => {
  users.push({ id: randomUUID(), email: payload().parent_email });
  calls.hideListedUsers = true;
  assert.equal((await mobile('', payload())).status, 409);
  assert.equal(users.length, 1);
  assert.equal(db.memberships.length, 0);
});

test('partial athlete and waiver writes can resume when rollback cannot reach Auth', async () => {
  calls.failAuthDelete = true;
  failures.push({ table: 'memberships', mode: 'insert', remaining: 1 });
  const body = payload();
  assert.equal((await mobile('', body)).status, 500);
  assert.equal(users.length, 1);
  assert.equal(db.kids.length, 1);
  assert.equal(db.family_waivers.length, 1);
  assert.equal((await mobile('', body)).status, 200);
  assert.equal(users.length, 1);
  assert.equal(db.kids.length, 1);
  assert.equal(db.family_waivers.length, 1);
  assert.equal(db.memberships.length, 1);
});

for (const invoiceStatus of ['requires_payment_method', 'requires_action']) {
  test(`EFT ${invoiceStatus} recovers via the same invoice with a replacement/authenticated card`, async () => {
    db.membership_plans[0].plan_type = 'eft';
    calls.subscriptionStatus = 'incomplete';
    calls.invoiceStatus = invoiceStatus;
    const { family, complete } = await prepared();
    intents.get(complete.stripe_intent_id).status = 'succeeded';
    const blocked = await mobile('/attach-payment', complete);
    assert.equal(blocked.status, 402);
    const recovery = (await blocked.json()).recovery_intent;
    assert.equal(recovery.intent_type, 'payment');
    assert.equal(db.staff_enrollment_requests[0].completed, false);
    const restored = await (await mobile('/setup-intent', { membership_id: family.membership_id })).json();
    assert.equal(restored.payment_confirmed, false, 'saved card is not proof that first invoice was paid');
    assert.equal(restored.billing_recovery_intent.client_secret, recovery.client_secret);
    assert.equal(restored.billing_recovery_intent.payment_status, invoiceStatus);
    const invoiceId = recovery.client_secret.split('_secret_')[0];
    const invoice = intents.get(invoiceId);
    if (invoiceStatus === 'requires_payment_method') assert.equal(invoice.setup_future_usage, 'off_session');
    // Native Stripe PaymentSheet supplies a new card or authenticates this PI.
    invoice.status = 'succeeded';
    invoice.payment_method = { id: 'pm_recovered', card: { brand: 'visa', last4: '5556', exp_month: 9, exp_year: 2031 } };
    [...subscriptions.values()][0].status = 'active';
    const paidStatus = await (await mobile('/setup-intent', { membership_id: family.membership_id })).json();
    assert.equal(paidStatus.payment_confirmed, true);
    assert.equal((await mobile('/attach-payment', complete)).status, 200);
    assert.equal(db.memberships[0].status, 'active');
    assert.equal(db.families[0].card_last4, '5556', 'replacement card becomes the saved renewal card');
    assert.equal(db.staff_enrollment_requests[0].completed, true);
    assert.equal(users.length, 1);
    assert.equal(subscriptions.size, 1);
    assert.equal(calls.http.filter(call => call.url === 'https://api.stripe.com/v1/subscriptions' && call.method === 'POST').length, 1);
    assert.equal(calls.emails.length, 1);
  });
}

test('lost EFT subscription database writes recover the same Stripe subscription on retry', async () => {
  db.membership_plans[0].plan_type = 'eft';
  const { complete } = await prepared();
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  failures.push({ table: 'memberships', mode: 'update', field: 'stripe_subscription_id', remaining: 2 });
  assert.equal((await mobile('/attach-payment', complete)).status, 502);
  assert.equal(db.staff_enrollment_requests[0].completed, false);
  assert.equal(db.memberships[0].stripe_subscription_id, undefined);
  assert.equal(subscriptions.size, 1);
  assert.equal((await mobile('/attach-payment', complete)).status, 200);
  assert.equal(subscriptions.size, 1);
  assert.equal(db.memberships[0].stripe_subscription_id, 'sub_1');
  assert.equal(db.memberships[0].status, 'active');
  assert.equal(calls.deniedBillingWrites ?? 0, 0, 'billing persistence uses only the server service client');
});

test('authenticated billing clients are read-only while server activation can persist a confirmed EFT', async () => {
  db.membership_plans[0].plan_type = 'eft';
  const { complete } = await prepared();
  const before = db.memberships[0].status;
  const denied = await callerClient().from('memberships').update({ status: 'active' }).eq('id', complete.membership_id);
  assert.equal(denied.error.code, '42501');
  assert.equal(db.memberships[0].status, before);
  const deniedPayment = await callerClient().from('payment_events').insert({ id: randomUUID() });
  assert.equal(deniedPayment.error.code, '42501');
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  const completed = await mobile('/attach-payment', complete);
  assert.equal(completed.status, 200, await completed.clone().text());
  assert.equal(db.memberships[0].status, 'active');
  assert.equal(db.memberships[0].stripe_subscription_id, 'sub_1');
  assert.equal(calls.deniedBillingWrites, 2, 'activation itself must not attempt an authenticated write');
  assert.equal(calls.emails.length, 1);
});

test('native API exposes recoverable first-invoice authentication without treating setup as payment', async () => {
  db.membership_plans[0].plan_type = 'eft';
  calls.subscriptionStatus = 'incomplete';
  calls.invoiceStatus = 'requires_action';
  const api = load('src/api/staffEnrollment.ts');
  const { family, intent, complete } = await prepared();
  intents.get(complete.stripe_intent_id).status = 'succeeded';
  await assert.rejects(() => api.completeStaffEnrollment(family, intent), error =>
    error instanceof api.EnrollmentApiError && error.status === 402 &&
    error.recoveryIntent.payment_status === 'requires_action');
  const restored = await api.createEnrollmentIntent(family.membership_id);
  assert.equal(restored.payment_confirmed, false);
  assert.equal(restored.billing_recovery_intent.payment_status, 'requires_action');
  assert.equal(restored.client_secret, intent.client_secret, 'root setup proof is retained separately');
});

test('billing function rejects editable metadata as proof of staff access', async () => {
  calls.userMetadataRole = 'owner';
  load('supabase/functions/stripe-create-subscription/index.ts');
  const response = await edgeHandler(new Request('https://supabase.fixture/functions/v1/stripe-create-subscription', {
    method: 'POST', headers: { Authorization: `Bearer ${token('parent')}` },
    body: JSON.stringify({ membership_id: randomUUID() }),
  }));
  assert.equal(response.status, 403);
});

for (const planType of ['eft', 'otc']) {
  test(`existing cookie-based portal ${planType} setup and payment still complete`, async () => {
    db.membership_plans[0].plan_type = planType;
    const portal = (suffix, body) => load(`portal/app/api/owner/enroll${suffix}/route.ts`).POST(
      new NextRequest(`https://portal.fixture/api/owner/enroll${suffix}`, { method: 'POST', body: JSON.stringify(body) }),
    );
    const family = await (await portal('', payload())).json();
    const result = await portal('/setup-intent', { membership_id: family.membership_id });
    assert.equal(result.status, 200);
    const intent = await result.json();
    const id = intent.client_secret.split('_secret_')[0];
    intents.get(id).status = 'succeeded';
    const completed = await portal('/attach-payment', {
      membership_id: family.membership_id, family_id: family.family_id, stripe_intent_id: id,
    });
    assert.equal(completed.status, 200, await completed.clone().text());
    assert.equal(db.memberships[0].status, 'active');
    assert.equal(calls.emails.length, 1);
  });
}
