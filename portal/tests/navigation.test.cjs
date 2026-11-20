const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

// Compile the actual TypeScript modules, with controlled boundaries and no network,
// credentials, live payment execution, or database writes.
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  function scopedRequire(id) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/') || id.startsWith('.')) {
      const target = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(filename), id);
      const found = [target, `${target}.ts`, `${target}.tsx`].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
      if (found) return load(path.relative(root, found), mocks);
    }
    return require(id);
  }
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(scopedRequire, mod, mod.exports);
  return mod.exports;
}
const kidId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const familyId = '33333333-3333-4333-8333-333333333333';
const locationId = '44444444-4444-4444-8444-444444444444';
const tenantId = '55555555-5555-4555-8555-555555555555';
const failRedirect = destination => { throw new Error(`redirect:${destination}`); };
const navigation = {
  redirect: failRedirect,
  notFound: () => { throw new Error('not-found'); },
  usePathname: () => '/owner',
  useRouter: () => ({ push() {}, refresh() {} }),
  useSearchParams: () => new URLSearchParams(),
};
const link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };

test('player links use IDs only and preserve the relevant history anchor', () => {
  const { playerHref } = load('lib/playerLinks.ts');
  assert.equal(playerHref({ kidId, membershipId }, 'payment-history'), `/owner/players/${kidId}?membership=${membershipId}#payment-history`);
  assert.equal(playerHref({ kidId }, 'package-history'), `/owner/players/${kidId}#package-history`);
  assert.equal(playerHref({ membershipId }), null);
  assert.equal(playerHref({ kidId: 'Same Name' }), null);
  assert.equal(playerHref({ kidId: '../other-tenant' }), null);
});

function ownerContext({ role = 'owner', tenant = tenantId, user = true, authError = null } = {}) {
  const token = Buffer.from(JSON.stringify({ app_role: role, tenant_id: tenant })).toString('base64url');
  const session = { access_token: `header.${token}.signature` };
  const calls = [];
  const client = { auth: {
    async getUser() { calls.push('getUser'); return { data: { user: user ? { id: 'user', app_metadata: {} } : null }, error: authError }; },
    async getSession() { calls.push('getSession'); return { data: { session } }; },
  } };
  const mod = load('lib/ownerAccess.ts', {
    react: { cache: fn => fn },
    'next/navigation': navigation,
    '@/lib/supabase/server': { createClient: async () => client },
  });
  return { ...mod, calls, client };
}

test('owner context validates identity before trusting tenant claims', async () => {
  const context = ownerContext();
  assert.equal((await context.requireOwnerContext()).tenantId, tenantId);
  assert.deepEqual(context.calls, ['getUser', 'getSession']);
});

for (const [label, options, destination] of [
  ['anonymous', { user: false }, '/login?reason=unauthenticated'],
  ['unverified session', { authError: { message: 'invalid token' } }, '/login?reason=unauthenticated'],
  ['missing tenant', { tenant: null }, '/login?reason=missing-tenant'],
  ['parent', { role: 'parent' }, '/logout?reason=parent'],
  ['coach', { role: 'coach' }, '/coach/inbox'],
  ['admin', { role: 'admin' }, '/admin'],
  ['network administrator', { role: 'super_admin' }, '/hq'],
]) test(`owner context denies ${label}`, async () => {
  await assert.rejects(ownerContext(options).requireOwnerContext(), e => e.message === `redirect:${destination}`);
});

function database(overrides = {}) {
  const calls = [];
  const rows = {
    kids: { id: kidId, family_id: familyId, first_name: 'Same', last_name: 'Name' },
    families: { id: familyId, primary_location_id: locationId },
    locations: { id: locationId },
    memberships: [{ id: membershipId, kid_id: kidId, family_id: familyId, plan_name: 'Pack' }],
    ...overrides,
  };
  const client = { from(table) {
    const filters = {};
    calls.push({ table, filters });
    const query = {
      select() { return query; },
      eq(key, value) { filters[key] = value; return query; },
      order() { return query; },
      maybeSingle() { return Promise.resolve({ data: rows[table], error: overrides.error ?? null }); },
      then(resolve, reject) { return Promise.resolve({ data: rows[table], error: overrides.error ?? null }).then(resolve, reject); },
    };
    return query;
  } };
  return { client, calls };
}

test('player reads pin kid, family, memberships and location to the authorized tenant', async () => {
  const { getScopedPlayer } = load('lib/supabase/playerProfile.ts');
  const db = database();
  const result = await getScopedPlayer(db.client, tenantId, kidId);
  assert.equal(result.kid.id, kidId);
  assert.equal(db.calls.length, 4);
  for (const call of db.calls) assert.equal(call.filters[call.table === 'kids' ? 'families.tenant_id' : 'tenant_id'], tenantId);
  assert.equal(db.calls[1].filters.id, familyId);
  assert.equal(db.calls[2].filters.id, locationId);
  assert.equal(db.calls[3].filters.kid_id, kidId);
  assert.equal(db.calls[3].filters.family_id, familyId);
});

for (const table of ['kids', 'families', 'locations']) test(`unavailable or cross-tenant ${table} denies player access`, async () => {
  const { getScopedPlayer } = load('lib/supabase/playerProfile.ts');
  const db = database({ [table]: null });
  assert.equal(await getScopedPlayer(db.client, tenantId, kidId), null);
  assert.ok(!db.calls.some(c => c.table === 'memberships'));
});

test('missing scope and malformed player IDs never query the database', async () => {
  const { getScopedPlayer } = load('lib/supabase/playerProfile.ts');
  const db = database();
  assert.equal(await getScopedPlayer(db.client, '', kidId), null);
  assert.equal(await getScopedPlayer(db.client, tenantId, 'Same Name'), null);
  assert.equal(db.calls.length, 0);
});

test('database errors are not shown as successful empty player history', async () => {
  const { getScopedPlayer } = load('lib/supabase/playerProfile.ts');
  await assert.rejects(getScopedPlayer(database({ error: { message: 'offline' } }).client, tenantId, kidId), /Unable to load player/);
});

test('a legacy membership link redirects to the same player with its selected package', async () => {
  const db = database({ memberships: { id: membershipId, kid_id: kidId } });
  const { default: page } = load('app/owner/members/[id]/page.tsx', {
    'next/navigation': navigation,
    '@/lib/ownerAccess': { requireOwnerContext: async () => ({ client: db.client, tenantId }) },
    '@/lib/supabase/playerProfile': { getScopedPlayer: async () => ({ memberships: [{ id: membershipId }] }) },
  });
  await assert.rejects(page({ params: Promise.resolve({ id: membershipId }) }),
    e => e.message === `redirect:/owner/players/${kidId}?membership=${membershipId}`);
});

test('foreign membership selection cannot open another player through a valid profile', async () => {
  const { default: page } = load('app/owner/players/[id]/page.tsx', {
    'next/navigation': navigation,
    'next/link': link,
    '@/lib/ownerAccess': { requireOwnerContext: async () => ({ client: {}, tenantId }) },
    '@/lib/supabase/playerProfile': { getScopedPlayer: async () => ({ memberships: [{ id: membershipId }] }) },
    '@/lib/supabase/ownerQueries': {},
    '../../members/[id]/MemberDetailContent': {},
  });
  await assert.rejects(page({ params: Promise.resolve({ id: kidId }), searchParams: Promise.resolve({ membership: locationId }) }), /not-found/);
});

test('Dashboard, Today and Members expose independent active navigation states', () => {
  for (const pathname of ['/owner', '/owner/dashboard', '/owner/members', `/owner/players/${kidId}`]) {
    const { PortalShell } = load('components/PortalShell.tsx', {
      'next/navigation': { ...navigation, usePathname: () => pathname },
      'next/link': link,
      '@/app/login/actions': { signOut: () => {} },
    });
    const html = renderToStaticMarkup(React.createElement(PortalShell, { role: 'owner' }, 'Content'));
    assert.match(html, /Clubhouse/);
    assert.match(html, /by Infinite Hitting/i);
    assert.match(html, /href="\/owner"/);
    assert.match(html, /href="\/owner\/dashboard"/);
    assert.match(html, /href="\/owner\/members"/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, /Skip to main content/);
  }
});

test('unlinked players have an explicit unavailable state rather than a name lookup', () => {
  const { PlayerLink } = load('components/owner/PlayerLink.tsx', { 'next/link': link });
  const html = renderToStaticMarkup(React.createElement(PlayerLink, { name: 'Same Name', reference: {} }));
  assert.match(html, /Profile unavailable/);
  assert.doesNotMatch(html, /href=/);
});

test('empty Billing never substitutes demo transactions or packages', () => {
  const { BillingContent } = load('app/owner/billing/BillingContent.tsx', {
    'next/navigation': navigation, 'next/link': link,
  });
  const kpis = { mrr: 0, collectedMtd: 0, autoPayRate: 0, pastDue: 0, failedPaymentsCount: 0, activeMembers: 0 };
  const html = renderToStaticMarkup(React.createElement(BillingContent, {
    data: { kpis, packages: [], recentTransactions: [], paidCount: 0, failedCount: 0, fetchedAt: '' },
  }));
  assert.match(html, /No recorded transactions/);
  assert.doesNotMatch(html, /Jake Martinez|80400|Unlimited Monthly/);
});

test('Today omits Coaches Today and provides keyboard/touch metric descriptions', () => {
  const { TodayDashboardContent } = load('app/owner/dashboard/TodayDashboardContent.tsx', { 'next/navigation': navigation, 'next/link': link });
  const html = renderToStaticMarkup(React.createElement(TodayDashboardContent, {
    tenantName: 'Test location',
    data: { stats: { sessionsToday: 0, revenueToday: 0, activeMembers: 0, coachesToday: 0 }, todayBookings: [], upcomingBookings: [] },
  }));
  assert.doesNotMatch(html, /Coaches On Today|Coaches Today/);
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /not collected payments/);
});

test('Payments has history/action navigation and truthful merchant and empty states', () => {
  const { PaymentsContent } = load('app/owner/payments/PaymentsContent.tsx', { 'next/navigation': navigation, 'next/link': link });
  const html = renderToStaticMarkup(React.createElement(PaymentsContent, { locations: [] }));
  assert.match(html, /No locations found/);
  assert.match(html, /\/owner\/billing#transaction-history/);
  assert.match(html, /\/owner\/failed-payments/);
  assert.match(html, /does not change the connected merchant/);
  assert.doesNotMatch(html, /97\.5%|Ballpark|account connected and verified!/);
});

test('root and password sign-in send authorized owners to Dashboard, not Today', async () => {
  const context = ownerContext();
  const client = context.client;
  const session = (await client.auth.getSession()).data.session;
  client.auth.signInWithPassword = async () => ({ data: { session, user: { user_metadata: {} } }, error: null });
  const mocks = {
    'next/navigation': navigation,
    '@/lib/supabase/server': { createClient: async () => client },
  };
  const { default: rootPage } = load('app/page.tsx', mocks);
  await assert.rejects(rootPage(), e => e.message === 'redirect:/owner');
  const { signIn } = load('app/login/actions.ts', mocks);
  const form = new FormData();
  form.set('email', 'fixture@example.test');
  form.set('password', 'local-test-only');
  await assert.rejects(signIn(form), e => e.message === 'redirect:/owner');
});

test('Today alternate URL preserves the established legacy destination', () => {
  const { default: alias } = load('app/owner/today/page.tsx', { 'next/navigation': navigation });
  assert.throws(alias, e => e.message === 'redirect:/owner/dashboard');
});

test('member filters are keyboard buttons and empty lists contain no demo players', () => {
  const { MembersContent } = load('app/owner/members/MembersContent.tsx', { 'next/navigation': navigation, 'next/link': link });
  const html = renderToStaticMarkup(React.createElement(MembersContent, { members: [] }));
  assert.match(html, /<button[^>]*aria-pressed="true"/);
  assert.match(html, /portal-sticky-controls/);
  assert.doesNotMatch(html, /Alex Owner Jr.|Jake Martinez/);
});

test('report drilldowns distinguish duplicate names and reject ambiguous joins', async () => {
  const { getRevenueTransactions } = load('lib/supabase/ownerQueries.ts');
  const secondKid = '66666666-6666-4666-8666-666666666666';
  const mem = kid => ({ id: membershipId, kid_id: kid, tenant_id: tenantId, plan_name: 'Pack', plan_type: 'otc',
    kids: { first_name: 'Same', last_name: 'Name' } });
  const rows = [mem(kidId), mem(secondKid), { ...mem(kidId), kids: [{ first_name: 'One' }, { first_name: 'Two' }] }, null]
    .map((membership, i) => ({ id: `event-${i}`, created_at: '2026-01-01T10:00:00Z', amount_cents: 1000,
      payment_method: 'card', status: 'paid', memberships: membership }));
  const filters = {};
  const query = {
    select() { return query; }, eq(key, value) { filters[key] = value; return query; },
    gte() { return query; }, lt() { return query; },
    order: async () => ({ data: rows, error: null }),
  };
  const records = await getRevenueTransactions({ from: () => query }, tenantId, '2026-01-01', '2026-01-31');
  assert.equal(records[0].memberName, records[1].memberName);
  assert.equal(records[0].kidId, kidId);
  assert.equal(records[1].kidId, secondKid);
  assert.equal(records[2].kidId, null);
  assert.equal(records[3].kidId, null);
  assert.equal(filters['memberships.tenant_id'], tenantId);
  assert.equal(filters['memberships.kids.families.tenant_id'], tenantId);
  query.order = async () => ({ data: null, error: { message: 'offline' } });
  await assert.rejects(getRevenueTransactions({ from: () => query }, tenantId, '2026-01-01', '2026-01-31'), /Unable to load transaction history/);
});

test('authorized profile renders all linked packages and scoped payment history', async () => {
  const filters = {};
  const packages = [
    { id: membershipId, plan_name: 'Old Pack', plan_type: 'otc', status: 'cancelled', started_at: '2025-01-01', sessions_remaining: 1, sessions_total: 4 },
    { id: locationId, plan_name: 'Current Pack', plan_type: 'otc', status: 'active', started_at: '2026-01-01', sessions_remaining: 3, sessions_total: 8 },
  ];
  const client = { from(table) {
    const q = {
      select() { return q; }, eq(key, value) { filters[`${table}.${key}`] = value; return q; },
      in(key, value) { filters[`${table}.${key}`] = value; return q; },
      order() { return q; },
      range: async (from, to) => {
        assert.equal(from, 0); assert.equal(to, 49);
        return { data: [{ id: 'payment', membership_id: membershipId, amount_cents: 2500, payment_method: 'card',
          created_at: '2026-01-01', status: 'paid' }], error: null, count: 1 };
      },
      maybeSingle: async () => ({ data: null, error: null }),
    };
    return q;
  } };
  const { default: page } = load('app/owner/players/[id]/page.tsx', {
    'next/navigation': navigation, 'next/link': link,
    '@/lib/supabase/serviceClient': { createServiceClient: () => client },
    '@/lib/ownerAccess': { requireOwnerContext: async () => ({ client, tenantId }) },
    '@/lib/supabase/playerProfile': { getScopedPlayer: async () => ({
      kid: { id: kidId, family_id: familyId, first_name: 'Same', last_name: 'Name' }, memberships: packages,
    }) },
    '@/lib/supabase/ownerQueries': {
      getMemberDetail: async () => ({ id: membershipId }), getBookingFormOptions: async () => ({}),
    },
    '../../members/[id]/MemberDetailContent': { MemberDetailContent: () => React.createElement('div', null, 'Profile detail') },
  });
  const element = await page({ params: Promise.resolve({ id: kidId }), searchParams: Promise.resolve({ membership: membershipId }) });
  const html = renderToStaticMarkup(element);
  assert.match(html, /id="payment-history"/);
  assert.match(html, /id="package-history"/);
  assert.match(html, /Old Pack/);
  assert.match(html, /Current Pack/);
  assert.match(html, /25\.00/);
  assert.equal(filters['payment_events.tenant_id'], tenantId);
  assert.deepEqual(filters['payment_events.membership_id'], packages.map(p => p.id));
});

test('store-order failures use a verified player ID even without a membership link', () => {
  const { FailedPaymentsContent } = load('app/owner/failed-payments/FailedPaymentsContent.tsx', {
    'next/navigation': navigation, 'next/link': link,
  });
  const html = renderToStaticMarkup(React.createElement(FailedPaymentsContent, { payments: [{
    id: 'order-failure', kidId, membershipId: null, member: 'Same Name', parent: 'Parent',
    amount: 10, package: 'Store item', failedDate: 'Jan 1', failedAt: '2026-01-01',
    reason: 'Declined', attempts: 1, nextAttempt: 'Unavailable', source: 'store_order',
    failureCount: 0, isPaused: false,
  }] }));
  assert.match(html, new RegExp(`/owner/players/${kidId}#payment-history`));
  assert.doesNotMatch(html, /Profile unavailable/);
});

test('client-side package navigation resets balances and sends overrides only to the selected package', async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><main id="portal-main"><div id="root"></div></main>', {
    url: `https://portal.example.test/owner/players/${kidId}?membership=${membershipId}`,
  });
  const prior = {};
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event, MouseEvent: dom.window.MouseEvent,
    ResizeObserver: class { observe() {} disconnect() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    prior[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const originalFetch = globalThis.fetch;
  const payloads = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/memberships/sessions');
    const payload = JSON.parse(options.body);
    payloads.push(payload);
    return { ok: true, json: async () => ({ ok: true, sessions_remaining: payload.sessions_remaining }) };
  };
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  let clientRoot;
  try {
    const baseMember = {
      kidId, name: 'Package switch fixture', age: '12U', parent: 'Fixture Parent', parentEmail: '',
      parentPhone: null, parentFirstName: 'Fixture', parentLastName: 'Parent', familyId,
      planType: 'otc', status: 'active', engagementScore: 50, churnRisk: 'low', lastSession: 'Never',
      nextCharge: '—', mrr: 0, lifetime: 100, joinedDate: 'Jan 2026',
      cardLast4: null, cardBrand: null, cardExpMonth: null, cardExpYear: null,
      bookingCount: 0, hittraxSessionCount: 0, pointsBalance: 0, timeline: [], recentPayments: [],
      stripeSubscriptionId: null, subscriptionStatus: 'none', nextBillingAt: null, cancelAt: null,
      pauseStart: null, pauseEnd: null, pausedAt: null, weeklySessionsUsed: null, weeklyTotal: null,
      weeklyPeriodStart: null, billingAnchorDay: null, scheduledCharges: [], sessionsTotal: 10,
    };
    const packA = { ...baseMember, id: membershipId, program: 'Pack A fixture', sessionsRemaining: 2 };
    const packB = { ...baseMember, id: locationId, program: 'Pack B fixture', sessionsRemaining: 7 };
    const members = new Map([[packA.id, packA], [packB.id, packB]]);
    let page;
    let pendingNavigation;
    function ClientLink({ href, children, onClick, ...props }) {
      return React.createElement('a', { ...props, href, onClick(event) {
        event.preventDefault();
        onClick?.(event);
        const selected = new URL(href, dom.window.location.href).searchParams.get('membership');
        if (selected && members.has(selected)) {
          // Mimic Next's query-only client navigation: keep the existing root,
          // replace only the server-rendered tree. React keys come from the
          // actual PlayerPage, not from a duplicate test-only wrapper.
          pendingNavigation = page({
            params: Promise.resolve({ id: kidId }), searchParams: Promise.resolve({ membership: selected }),
          }).then(tree => clientRoot.render(tree));
        }
      } }, children);
    }
    const mocks = {
      'next/navigation': navigation,
      'next/link': { __esModule: true, default: ClientLink },
    };
    const detailModule = load('app/owner/members/[id]/MemberDetailContent.tsx', mocks);
    const historyClient = { from() {
      const q = {
        select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; },
        range: async () => ({ data: [], error: null, count: 0 }),
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return q;
    } };
    page = load('app/owner/players/[id]/page.tsx', {
      ...mocks,
      '@/lib/ownerAccess': { requireOwnerContext: async () => ({ client: historyClient, tenantId }) },
      '@/lib/supabase/serviceClient': { createServiceClient: () => historyClient },
      '@/lib/supabase/playerProfile': { getScopedPlayer: async () => ({
        kid: { id: kidId, family_id: familyId, first_name: 'Package', last_name: 'fixture' },
        memberships: [...members.values()].map(m => ({
          id: m.id, plan_name: m.program, plan_type: m.planType, status: m.status,
          sessions_remaining: m.sessionsRemaining, sessions_total: m.sessionsTotal, started_at: '2026-01-01',
        })),
      }) },
      '@/lib/supabase/ownerQueries': {
        getMemberDetail: async (_client, _tenant, id) => members.get(id),
        getBookingFormOptions: async () => ({ coaches: [], sessionTypes: [], locations: [] }),
      },
      '../../members/[id]/MemberDetailContent': detailModule,
    }).default;
    clientRoot = createRoot(dom.window.document.getElementById('root'));
    await act(async () => {
      const tree = await page({ params: Promise.resolve({ id: kidId }), searchParams: Promise.resolve({ membership: packA.id }) });
      clientRoot.render(tree);
    });
    const button = text => [...dom.window.document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    const numberInput = () => dom.window.document.querySelector('input[type="number"]');
    await act(async () => button('Override sessions remaining').click());
    assert.equal(numberInput().value, '2');

    // Leave A's override open while navigating. B must not retain either
    // the open editor, A's balance, or A's pending submission state.
    await act(async () => {
      const packageLink = [...dom.window.document.querySelectorAll('#package-history a')]
        .find(a => a.textContent.includes('Pack B fixture'));
      packageLink.click();
      await pendingNavigation;
    });
    assert.equal(numberInput(), null, 'A’s open override must close when B is selected');
    assert.match(dom.window.document.querySelector('h1').textContent, /Package switch fixture/);
    const override = button('Override sessions remaining');
    assert.match(override.parentElement.textContent, /7of 10 remaining/);
    await act(async () => override.click());
    assert.equal(numberInput().value, '7', 'B’s editor must start from B’s remaining sessions');
    await act(async () => button('Save').click());
    assert.deepEqual(payloads, [{ membership_id: packB.id, sessions_remaining: 7 }]);

    // Switching back must remount A with its original recorded balance.
    await act(async () => {
      [...dom.window.document.querySelectorAll('#package-history a')]
        .find(a => a.textContent.includes('Pack A fixture')).click();
      await pendingNavigation;
    });
    assert.match(button('Override sessions remaining').parentElement.textContent, /2of 10 remaining/);
  } finally {
    if (clientRoot) await act(async () => clientRoot.unmount());
    dom.window.close();
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of Object.entries(prior)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
