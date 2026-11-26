const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('module');
const ts = require('typescript');

const portalRoot = path.resolve(__dirname, '..');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {};
  return originalLoad.apply(this, arguments);
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('.')) {
    const base = path.resolve(path.dirname(parent.filename), request);
    if (fs.existsSync(`${base}.ts`)) return originalResolve.call(this, `${base}.ts`, parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(portalRoot)) return;
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};

const { graphGetAll, metaGraphFetch, RETRYABLE_META_CODES } = require('../lib/marketing/meta/graphClient.ts');
const { parseInsightRow, buildAccountReport, extractLeads, toMetricBlock } = require('../lib/marketing/meta/insights.ts');
const { parseAdAccountMap, accountForLocation, connectionForAccount, reportingMode } = require('../lib/marketing/accounts.ts');
const { fixtureResponse, canonicalDailyReachSum } = require('../lib/marketing/meta/fixtures.ts');
const { toMinorUnits, ratioFromSums, resolveWindow } = require('../lib/marketing/metrics.ts');

const TOKEN = 'super-secret-token-value';
let envChain = Promise.resolve();
function withEnv(run) {
  const next = envChain.then(run, run);
  envChain = next.then(() => undefined, () => undefined);
  return next;
}
const fast = { minGapMs: 0, maxRetries: 0, timeoutMs: 1000, backoffMs: () => 0, sleepImpl: async () => {} };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('pagination that still has a next cursor is incomplete', async () => {
  const pages = [
    { data: [{ id: 1 }], paging: { cursors: { after: 'cursor-1' }, next: 'https://graph.facebook.com/v27.0/act_1/insights?page=2' } },
    { data: [{ id: 2 }], paging: { cursors: { after: 'cursor-2' }, next: 'https://graph.facebook.com/v27.0/act_1/insights?page=3' } },
  ];
  let calls = 0;
  const result = await graphGetAll('https://graph.facebook.com/v27.0/act_1/insights', {
    ...fast,
    maxPages: 1,
    fetchImpl: async () => jsonResponse(pages[calls++]),
  });
  assert.equal(calls, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.incomplete, true);
});

test('a final page cursor without a next URL is complete', async () => {
  const result = await graphGetAll('https://graph.facebook.com/v27.0/act_1/insights', {
    ...fast,
    fetchImpl: async () => jsonResponse({ data: [{ id: 1 }], paging: { cursors: { after: 'last' } } }),
  });
  assert.equal(result.incomplete, false);
  assert.equal(result.rows.length, 1);
});

test('the client is GET only and does not log the token', async () => {
  let called = 0;
  await assert.rejects(
    () => metaGraphFetch('https://graph.facebook.com/v27.0/act_1/insights', { method: 'POST' }, { ...fast, fetchImpl: async () => { called += 1; return jsonResponse({}); } }),
    /GET only/,
  );
  assert.equal(called, 0);

  await withEnv(async () => {
    process.env.META_SYSTEM_USER_TOKEN = TOKEN;
    const logs = [];
    const previous = console.error;
    console.error = (...parts) => logs.push(parts.join(' '));
    try {
      await assert.rejects(
        () => graphGetAll(`https://graph.facebook.com/v27.0/act_1/insights?access_token=${TOKEN}`, {
          ...fast,
          fetchImpl: async () => { throw new Error('network down'); },
        }),
      );
    } finally {
      console.error = previous;
      delete process.env.META_SYSTEM_USER_TOKEN;
    }
    const text = logs.join('\n');
    assert.equal(text.includes(TOKEN), false);
    assert.equal(text.includes('access_token'), false);
  });
});

test('retryable Meta codes include the ads throttles', () => {
  for (const code of [4, 17, 613, 80004]) assert.equal(RETRYABLE_META_CODES.has(code), true);
});

test('a missing lead action is null, and conversions are not a fallback', () => {
  const missing = parseInsightRow({
    spend: '10.00',
    account_currency: 'USD',
    impressions: '100',
    inline_link_clicks: '4',
    conversions: '9',
    actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', value: '4' }],
  }, 'account');
  assert.equal(missing.leads, null);
  assert.equal(extractLeads([{ action_type: 'purchase', value: '3' }]), null);

  const both = parseInsightRow({
    spend: '10.00',
    account_currency: 'USD',
    actions: [
      { action_type: 'lead', value: '5' },
      { action_type: 'onsite_conversion.lead_grouped', value: '5' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '20' },
    ],
    conversions: '20',
  }, 'account');
  assert.equal(both.leads, 5);

  const explicitZero = parseInsightRow({
    spend: '10.00',
    account_currency: 'USD',
    actions: [{ action_type: 'lead', value: '0' }],
    conversions: '8',
  }, 'account');
  assert.equal(explicitZero.leads, 0);
});

test('reach is not summed across days, and CTR CPC CPL come from sums', () => {
  const daily = [
    { date_start: '2026-11-01', spend: '10.00', impressions: '100', inline_link_clicks: '10', reach: '80', account_currency: 'USD', actions: [{ action_type: 'lead', value: '2' }], ctr: '10', cpc: '1' },
    { date_start: '2026-11-02', spend: '30.00', impressions: '1000', inline_link_clicks: '10', reach: '90', account_currency: 'USD', actions: [{ action_type: 'lead', value: '2' }], ctr: '1', cpc: '3' },
  ].map((row) => parseInsightRow(row, 'account'));
  const withoutAggregate = buildAccountReport({
    daily, aggregate: [], campaigns: [], dailyIncomplete: false, aggregateIncomplete: false, campaignsIncomplete: false,
  });
  assert.equal(withoutAggregate.summary.reach, null);
  assert.equal(withoutAggregate.summary.link_ctr, 20 / 1100);
  assert.notEqual(withoutAggregate.summary.link_ctr, (0.10 + 0.01) / 2);
  assert.equal(withoutAggregate.summary.spend_minor, 4000);
  assert.equal(withoutAggregate.summary.cpc_minor, 4000 / 20);
  assert.equal(withoutAggregate.summary.cpl_minor, 4000 / 4);
  assert.equal(withoutAggregate.currency, 'USD');

  const aggregate = parseInsightRow({
    spend: '40.00', impressions: '1100', inline_link_clicks: '20', reach: '150', account_currency: 'USD',
    actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '4' }],
    frequency: '9.99', ctr: '50',
  }, 'account');
  const campaigns = [
    parseInsightRow({ campaign_id: '1', campaign_name: 'A', spend: '25.00', impressions: '700', inline_link_clicks: '12', reach: '100', account_currency: 'USD', actions: [{ action_type: 'lead', value: '3' }] }, 'campaign'),
    parseInsightRow({ campaign_id: '2', campaign_name: 'B', spend: '15.00', impressions: '400', inline_link_clicks: '8', reach: '80', account_currency: 'USD', actions: [{ action_type: 'lead', value: '1' }] }, 'campaign'),
  ];
  const withAggregate = buildAccountReport({
    daily, aggregate: [aggregate], campaigns, dailyIncomplete: false, aggregateIncomplete: false, campaignsIncomplete: false,
  });
  assert.equal(withAggregate.summary.reach, 150);
  assert.notEqual(withAggregate.summary.reach, 80 + 90);
  assert.notEqual(withAggregate.summary.reach, 100 + 80);
  assert.equal(withAggregate.entities[0].reach, 100);
  assert.equal(withAggregate.entities[1].reach, 80);
  assert.equal(withAggregate.summary.frequency, 1100 / 150);
});

test('zero spend stays zero and a zero denominator is unavailable', () => {
  const row = parseInsightRow({
    spend: '0.00', impressions: '50', inline_link_clicks: '0', reach: '40', account_currency: 'USD',
    actions: [{ action_type: 'lead', value: '0' }],
  }, 'account');
  const metrics = toMetricBlock(row);
  assert.equal(row.spend_minor, 0);
  assert.equal(row.leads, 0);
  assert.equal(metrics.link_ctr, 0);
  assert.equal(metrics.cpc_minor, null);
  assert.equal(metrics.cpl_minor, null);

  const withClicks = toMetricBlock(parseInsightRow({
    spend: '0.00', impressions: '10', inline_link_clicks: '4', account_currency: 'USD',
    actions: [{ action_type: 'lead', value: '2' }],
  }, 'account'));
  assert.equal(withClicks.cpc_minor, 0);
  assert.equal(withClicks.cpl_minor, 0);
  assert.equal(parseInsightRow({ impressions: '10', account_currency: 'USD' }, 'account').spend_minor, null);
});

test('currency is carried through integer minor units', () => {
  assert.equal(toMinorUnits('12.34', 'USD'), 1234);
  assert.equal(toMinorUnits('0.02', 'USD'), 2);
  assert.equal(toMinorUnits('19.99', 'USD') + toMinorUnits('0.02', 'USD'), 2001);
  assert.equal(toMinorUnits('1500', 'JPY'), 1500);
  assert.equal(toMinorUnits('12.34', null), null);
  const row = parseInsightRow({ spend: '12.34', impressions: '1', inline_link_clicks: '1', account_currency: 'USD' }, 'account');
  assert.equal(row.spend_minor, 1234);
  assert.equal(row.currency, 'USD');
  assert.equal(ratioFromSums(0, 4), 0);
  assert.equal(ratioFromSums(4, 0), null);
  assert.equal(ratioFromSums(null, 4), null);
});

test('a location without a mapping is not connected, and preview never uses the token', async () => {
  const { map, error } = parseAdAccountMap(JSON.stringify({
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'act_42',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': '99',
    'cccccccc-cccc-cccc-cccc-cccccccccccc': 'not-an-account',
  }));
  assert.equal(error, null);
  assert.equal(accountForLocation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', map), 'act_42');
  assert.equal(accountForLocation('BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB', map), 'act_99');
  assert.equal(map['cccccccc-cccc-cccc-cccc-cccccccccccc'], undefined);
  const unmapped = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  assert.equal(accountForLocation(unmapped, map), null);
  assert.equal(connectionForAccount(null), 'not_connected');
  assert.equal(connectionForAccount('act_42'), 'connected');
  assert.equal(parseAdAccountMap('{').error.length > 0, true);

  await withEnv(async () => {
    process.env.META_SYSTEM_USER_TOKEN = TOKEN;
    assert.equal(reportingMode(true), 'sample');
    delete process.env.META_SYSTEM_USER_TOKEN;
    assert.equal(reportingMode(false), 'sample');
    process.env.META_SYSTEM_USER_TOKEN = TOKEN;
    assert.equal(reportingMode(false), 'live');
    delete process.env.META_SYSTEM_USER_TOKEN;
  });
});

test('fixture week keeps currency, recomputes ratios, and does not sum reach', () => {
  const report = fixtureResponse({
    locations: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Frisco Academy', ad_account_id: 'act_999', connection: 'connected' }],
    locationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    from: '2026-11-19',
    to: '2026-11-25',
    level: 'campaign',
    parent: null,
    now: new Date('2026-11-26T18:00:00Z'),
  });
  assert.equal(report.mode, 'sample');
  assert.equal(report.ad_account_id, null);
  assert.equal(report.currency, 'USD');
  assert.equal(report.summary.spend_minor, 30000);
  assert.equal(report.summary.impressions, 21500);
  assert.equal(report.summary.inline_link_clicks, 400);
  assert.equal(report.summary.leads, 32);
  assert.equal(report.summary.reach, 12800);
  assert.notEqual(report.summary.reach, canonicalDailyReachSum());
  assert.equal(report.summary.link_ctr, 400 / 21500);
  assert.equal(report.summary.cpc_minor, 75);
  assert.equal(report.summary.cpl_minor, 30000 / 32);
  const entityReach = report.entities.reduce((sum, row) => sum + row.reach, 0);
  assert.notEqual(entityReach, report.summary.reach);
  assert.equal(report.locations[0].connection, 'sample');
  assert.equal(report.note, 'Sample data, not provider-verified');
});

test('date presets end on yesterday in the account timezone', () => {
  const window = resolveWindow({
    preset: '7', from: null, to: null, timeZone: 'America/Chicago', now: new Date('2026-11-26T18:00:00Z'),
  });
  assert.equal(window.from, '2026-11-19');
  assert.equal(window.to, '2026-11-25');
  assert.equal(window.usedUtcFallback, false);
  const bad = resolveWindow({ preset: null, from: '2026-02-31', to: '2026-03-01', timeZone: 'UTC' });
  assert.equal('error' in bad, true);
});
