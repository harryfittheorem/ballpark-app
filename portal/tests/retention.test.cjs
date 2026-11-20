const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
    id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts', mocks);
      if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), id)) + '.ts', mocks);
      return require(id);
    }, mod, mod.exports);
  return mod.exports;
}
const { buildRetentionReport: report, tenureBand, monthBoundary, lastCompletedMonth } = load('lib/retention/engine.ts');
const policy = {
  version: 'fixture-only-not-approved', effectiveFrom: '2026-01-01T00:00:00Z', approvalReference: 'TEST FIXTURE ONLY',
  entity: 'player', loss: 'absent_at_close', pauses: 'retained', expiry: 'expires_at',
  reactivation: 'retained_at_close', transfer: 'opening_location', location: 'family_primary_at_open',
  cancellationDate: 'cancel_effective_at_then_cancelled_at', timezone: 'location', segments: 'recorded_at_open',
  tenure: 'current_spell_elapsed_days', privacy: 'owner_names_network_aggregate',
};
let seq = 0;
function member(kid, membership = kid, at = '2026-01-10T00:00:00Z', state = {}, source = 'insert') {
  return { id: `e${++seq}`, tenant_id: 't1', membership_id: membership, kid_id: kid,
    effective_at: at, recorded_at: at, source,
    state: { status: 'active', started_at: '2026-01-10T00:00:00Z', ...state } };
}
function segment(kid, at = '2026-01-10T00:00:00Z', state = {}, location_id = 'l1') {
  return { id: `s${++seq}`, tenant_id: 't1', kid_id: kid, location_id,
    effective_at: at, recorded_at: at, source: 'insert',
    state: { division: '10U', sport: 'Baseball', gender: 'Male', competition: 'Rec', ...state } };
}
function data() {
  return { scope: 'owner', locations: [{ id: 'l1', tenant_id: 't1', name: 'One', timezone: 'America/New_York' },
    { id: 'l2', tenant_id: 't1', name: 'Two', timezone: 'America/New_York' }],
  memberships: [member('k1'), member('k2')], segments: [segment('k1'), segment('k2')],
  coverage: [{ tenant_id: 't1', started_at: '2026-01-01T00:00:00Z' }],
  policies: [{ tenant_id: 't1', policy }], names: { 't1:k1': 'Player One', 't1:k2': 'Player Two' },
  issues: [], finance: { available: false, reason: 'No finance contract' },
  instructors: { available: false, reason: 'No attribution contract' }, asOf: '2026-05-05T00:00:00Z' };
}
const filters = { startMonth: '2026-02', endMonth: '2026-02' };
test('one denominator: losses, detail, retained, division and tenure reconcile', () => {
  const d = data();
  d.memberships.push(member('k1', 'k1', '2026-02-12T13:00:00Z', { status: 'cancelled', cancelled_at: '2026-02-12T13:00:00Z' }));
  const r = report(d, filters);
  assert.equal(r.opening, 2); assert.equal(r.losses, 1); assert.equal(r.retained, 1);
  assert.equal(r.churnRate, 50); assert.equal(r.retentionRate, 50);
  assert.equal(r.losses, r.lostPlayers.length);
  assert.equal(r.lostPlayers[0].effectiveAt, '2026-02-12T13:00:00.000Z');
  for (const rows of [r.tenure, r.divisions]) {
    assert.equal(rows.reduce((s, x) => s + x.opening, 0), r.opening);
    assert.equal(rows.reduce((s, x) => s + x.losses, 0), r.losses);
  }
});
test('effective cancellation, not request or processing date; expiry is nonrenewal', () => {
  const d = data();
  d.memberships.push(member('k1', 'k1', '2026-01-29T00:00:00Z', { cancel_effective_at: '2026-02-20T00:00:00Z' }));
  d.memberships.push(member('k2', 'k2', '2026-01-29T00:00:00Z', { expires_at: '2026-02-25T00:00:00Z' }));
  const r = report(d, filters);
  assert.equal(r.losses, 2);
  assert.deepEqual(r.lostPlayers.map(x => x.reason).sort(), ['cancellation', 'nonrenewal']);
});
test('duplicate contracts count one player; surviving contract avoids a false loss', () => {
  const d = data();
  d.memberships.push(member('k1', 'duplicate'), member('k1', 'k1', '2026-02-12T00:00:00Z',
    { status: 'cancelled', cancelled_at: '2026-02-12T00:00:00Z' }));
  const r = report(d, filters);
  assert.equal(r.opening, 2); assert.equal(r.losses, 0);
});
test('pauses are retained only under the fixture-approved policy; reactivation is closing-state based', () => {
  const d = data();
  d.memberships.push(member('k1', 'k1', '2026-02-12T00:00:00Z', { status: 'paused' }),
    member('k2', 'k2', '2026-02-10T00:00:00Z', { status: 'cancelled', cancelled_at: '2026-02-10T00:00:00Z' }),
    member('k2', 'k2', '2026-02-25T00:00:00Z', { status: 'active', cancelled_at: null }));
  assert.equal(report(d, filters).losses, 0);
});
test('transfer retains player in opening location and is not a network loss', () => {
  const d = data();
  d.segments.push(segment('k1', '2026-02-05T00:00:00Z', {}, 'l2'));
  assert.equal(report(d, { ...filters, locationId: 'l1' }).opening, 2);
  assert.equal(report(d, { ...filters, locationId: 'l1' }).losses, 0);
  assert.equal(report(d, { ...filters, locationId: 'l2' }).opening, 0);
  assert.equal(report(d, { startMonth: '2026-03', endMonth: '2026-03', locationId: 'l2' }).opening, 1);
});
test('combined segment filters use opening history; birthdays and overrides do not rewrite closed results', () => {
  const d = data();
  const f = { ...filters, division: '10U', sport: 'Baseball', gender: 'Male', competition: 'Rec' };
  const before = report(d, f);
  d.segments.push(segment('k1', '2026-03-04T00:00:00Z', { division: 'High School', sport: 'Softball', gender: 'Female', competition: 'Travel' }));
  assert.deepEqual(report(d, f), before);
  assert.equal(report(d, { ...f, competition: 'Both' }).opening, 0);
});
test('late source edits cannot rewrite prior closed periods, even with backdated loss dates', () => {
  const d = data(), before = report(d, filters);
  d.memberships.push(member('k1', 'k1', '2026-04-01T00:00:00Z', { status: 'cancelled', cancelled_at: '2026-02-05T00:00:00Z' }));
  const late = segment('k2', '2026-01-15T00:00:00Z', { division: 'College' });
  late.recorded_at = '2026-04-01T00:00:00Z';
  d.segments.push(late);
  assert.deepEqual(report(d, filters), before);
});
test('zero denominators, missing policy, missing history and partial ranges never become 100%', () => {
  const d = data();
  assert.equal(report(d, { ...filters, sport: 'Softball' }).retentionRate, null);
  d.policies = [];
  assert.equal(report(d, filters).opening, null);
  d.policies = [{ tenant_id: 't1', policy }];
  d.coverage[0].started_at = '2026-02-10T00:00:00Z';
  const r = report(d, { startMonth: '2026-02', endMonth: '2026-03' });
  assert.equal(r.retentionRate, null); assert.equal(r.opening, null); assert.deepEqual(r.lostPlayers, []);
});
test('baseline classifications do not imply past segments or prior tenure', () => {
  const d = data();
  d.memberships[0] = member('k1', 'k1', '2026-01-10T00:00:00Z', { started_at: '2020-01-01T00:00:00Z' }, 'baseline');
  const r = report(d, filters);
  assert.equal(r.tenure.find(x => x.label === 'Unknown prior history').opening, 1);
  d.segments[0].effective_at = d.segments[0].recorded_at = '2026-02-10T00:00:00Z';
  assert.equal(report(d, filters).opening, null);
});
test('all specified day-band boundaries are non-overlapping; after 360 is explicitly unapproved', () => {
  for (const [n, label] of [[0, '0–30 days'], [30, '0–30 days'], [31, '31–90 days'], [90, '31–90 days'],
    [91, '91–180 days'], [180, '91–180 days'], [181, '181–270 days'], [270, '181–270 days'],
    [271, '271–360 days'], [360, '271–360 days'], [361, 'After 360 days — policy pending'], [null, 'Unknown prior history']]) {
    assert.equal(tenureBand(n), label);
  }
});
test('observed gaps reset tenure and overlapping contracts preserve the continuous spell', () => {
  const d = data();
  d.memberships.push(member('k1', 'overlap', '2026-01-25T00:00:00Z', { started_at: '2026-01-25T00:00:00Z' }));
  d.memberships.push(member('k1', 'k1', '2026-02-05T00:00:00Z', { status: 'cancelled', cancelled_at: '2026-02-05T00:00:00Z' }));
  let r = report(d, { startMonth: '2026-03', endMonth: '2026-03' });
  assert.equal(r.tenure.find(x => x.label === '31–90 days').opening, 2);
  d.memberships.push(member('k1', 'overlap', '2026-02-10T00:00:00Z', { status: 'cancelled', cancelled_at: '2026-02-10T00:00:00Z' }));
  d.memberships.push(member('k1', 'k1', '2026-02-25T00:00:00Z', { status: 'active' }));
  r = report(d, { startMonth: '2026-03', endMonth: '2026-03' });
  assert.equal(r.tenure.find(x => x.label === '0–30 days').opening, 1);
});
test('baseline prior tenure becomes known only after an observed gap and reactivation', () => {
  const d = data();
  const old = { started_at: '2020-01-01T00:00:00Z' };
  d.memberships[0] = member('k1', 'k1', '2026-01-10T00:00:00Z', old, 'baseline');
  d.memberships.push(member('k1', 'k1', '2026-02-10T00:00:00Z', { ...old, status: 'cancelled', cancelled_at: '2026-02-10T00:00:00Z' }));
  d.memberships.push(member('k1', 'k1', '2026-02-25T00:00:00Z', { ...old, status: 'active' }));
  const r = report(d, { startMonth: '2026-03', endMonth: '2026-03' });
  assert.equal(r.tenure.find(x => x.label === 'Unknown prior history').opening, 0);
  assert.equal(r.tenure.find(x => x.label === '0–30 days').opening, 1);
});
test('a first observation with a post-coverage but backdated start has unknown tenure until an observed new spell', () => {
  const d = data();
  d.memberships = [member('k1', 'k1', '2026-03-01T00:00:00Z', { started_at: '2026-01-15T00:00:00Z' })];
  let r = report(d, { startMonth: '2026-04', endMonth: '2026-04' });
  assert.equal(r.opening, 1);
  assert.equal(r.tenure.find(x => x.label === 'Unknown prior history').opening, 1);
  assert.equal(r.tenure.find(x => x.label === '31–90 days').opening, 0);
  d.memberships.push(member('k1', 'k1', '2026-03-10T00:00:00Z', {
    started_at: '2026-01-15T00:00:00Z', status: 'cancelled', cancelled_at: '2026-03-10T00:00:00Z',
  }));
  d.memberships.push(member('k1', 'k1', '2026-03-25T00:00:00Z', { started_at: '2026-01-15T00:00:00Z' }));
  r = report(d, { startMonth: '2026-04', endMonth: '2026-04' });
  assert.equal(r.tenure.find(x => x.label === 'Unknown prior history').opening, 0);
  assert.equal(r.tenure.find(x => x.label === '0–30 days').opening, 1);
});
test('a newer unsupported governing policy cannot fall back to an older supported policy', () => {
  const d = data();
  d.policies.push({ tenant_id: 't1', policy: {
    ...policy, version: 'new-fixture-only', effectiveFrom: '2026-03-01T00:00:00Z', entity: 'membership',
  } });
  assert.equal(report(d, filters).opening, 2);
  const r = report(d, { startMonth: '2026-03', endMonth: '2026-03' });
  assert.equal(r.opening, null); assert.equal(r.losses, null);
  assert.equal(r.retentionRate, null); assert.deepEqual(r.lostPlayers, []);
  assert.match(r.unavailable.join(' '), /policy unavailable/);
  assert.equal(report(d, { startMonth: '2026-03', endMonth: '2026-03', locationId: 'l1' }).opening, null);
});
test('DST and month boundaries use location timezone; exact-midnight exits belong to one month', () => {
  assert.equal(new Date(monthBoundary('2026-03', 'America/New_York')).toISOString(), '2026-03-01T05:00:00.000Z');
  assert.equal(new Date(monthBoundary('2026-04', 'America/New_York')).toISOString(), '2026-04-01T04:00:00.000Z');
  assert.equal(lastCompletedMonth(new Date('2026-03-01T02:00:00Z'), 'America/New_York'), '2026-01');
  const d = data();
  d.memberships.push(member('k1', 'k1', '2026-01-29T00:00:00Z', { cancel_effective_at: '2026-03-01T05:00:00Z' }));
  assert.equal(report(d, filters).losses, 0);
  assert.equal(report(d, { startMonth: '2026-03', endMonth: '2026-03' }).losses, 1);
});
test('new signups during a month are excluded from its opening cohort', () => {
  const d = data();
  d.memberships.push(member('k3', 'k3', '2026-02-02T00:00:00Z', { started_at: '2026-02-02T00:00:00Z' }));
  d.segments.push(segment('k3', '2026-02-02T00:00:00Z'));
  assert.equal(report(d, filters).opening, 2);
});
test('multi-month rate is summed losses / opening opportunities, not an annualized proxy', () => {
  const d = data();
  d.memberships.push(member('k1', 'k1', '2026-02-12T00:00:00Z', { status: 'cancelled', cancelled_at: '2026-02-12T00:00:00Z' }));
  const r = report(d, { startMonth: '2026-02', endMonth: '2026-03' });
  assert.equal(r.opening, 3); assert.equal(r.losses, 1); assert.equal(r.churnRate, 33.3);
});
test('missing effective-date evidence, invalid scope, future and malformed ranges fail explicitly', () => {
  const d = data();
  d.memberships.push(member('k1', 'k1', '2026-02-12T00:00:00Z', { status: 'cancelled' }));
  assert.equal(report(d, filters).losses, null);
  assert.equal(report(d, { ...filters, locationId: 'other-tenant' }).opening, null);
  assert.equal(report(d, { startMonth: '2026-05', endMonth: '2026-05' }).opening, null);
  assert.equal(report(d, { startMonth: 'bad', endMonth: '2026-05' }).opening, null);
});
test('network policy mismatch fails closed and network details have no personal names', () => {
  const d = data(); d.scope = 'network';
  d.memberships.push(member('k1', 'k1', '2026-02-12T00:00:00Z', { status: 'cancelled', cancelled_at: '2026-02-12T00:00:00Z' }));
  assert.equal(report(d, filters).lostPlayers[0].name, null);
  d.locations.push({ id: 'other', tenant_id: 't2', name: 'Other tenant', timezone: 'UTC' });
  d.coverage.push({ tenant_id: 't2', started_at: '2026-01-01T00:00:00Z' });
  d.policies.push({ tenant_id: 't2', policy: { ...policy, pauses: 'excluded' } });
  assert.equal(report(d, filters).opening, null);
});
test('network reader checks authenticated user AND database authorization before querying evidence', async () => {
  const { getRetentionDataset } = load('lib/retention/queries.ts');
  await assert.rejects(() => getRetentionDataset({ auth: { getUser: async () => ({ data: { user: null } }) } }, { kind: 'network' }), /verified network access/);
  let queried = false;
  const denied = { auth: { getUser: async () => ({ data: { user: { id: 'u' } } }) },
    from(table) {
      assert.equal(table, 'super_admins'); queried = true;
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null }; } };
    } };
  await assert.rejects(() => getRetentionDataset(denied, { kind: 'network' }), /verified network access/);
  assert.equal(queried, true);
});
test('owner reader pins every evidence and name query; missing migration is unavailable', async () => {
  const { getRetentionDataset } = load('lib/retention/queries.ts');
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    return { select() { return this; }, order() { return this; }, range() { return this; }, lte() { return this; },
      eq(...args) { call.filters.push(args); return this; },
      then(resolve) { resolve({ data: [], error: table === 'retention_membership_history' ? { message: 'missing' } : null }); } };
  } };
  const r = await getRetentionDataset(client, { kind: 'owner', tenantId: 'owner-tenant' });
  assert.ok(r.issues.length); assert.equal(report(r, filters).retentionRate, null);
  for (const call of calls) assert.ok(call.filters.some(([key, value]) => key === 'tenant_id' && value === 'owner-tenant'));
});
test('rendered owner and network surfaces expose unavailable states without fabricated metrics', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const d = data(); d.policies = [];
  const mocks = {
    '@/components/owner/ui': { PageHeader: ({ title, subtitle }) => React.createElement('header', null, title, subtitle) },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
  };
  const { RetentionReportContent } = load('components/owner/RetentionReportContent.tsx', mocks);
  const html = renderToStaticMarkup(React.createElement(RetentionReportContent, { data: d }));
  assert.match(html, /Unavailable/);
  assert.match(html, /Rec \/ Travel \/ Both/);
  assert.match(html, /High School/);
  assert.match(html, /Last completed month/);
  assert.doesNotMatch(html, /91\.2|5880|100\.0%|Sample data|vs last month/);
  const { NetworkRetentionContent } = load('app/hq/churn-analysis/NetworkRetentionContent.tsx');
  const network = renderToStaticMarkup(React.createElement(NetworkRetentionContent, { data: { ...d, scope: 'network' }, searchParams: {} }));
  assert.match(network, /Network Churn/); assert.match(network, /LTV/);
  assert.doesNotMatch(network, /Average Retention|Avg Retention|Player One|k1|t1:k1|membership_id/);
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(NetworkRetentionContent, { data: { ...d, scope: 'network' }, searchParams: { endMonth: 'bad' } })));
});
