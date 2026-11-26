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

const {
  daysAfter,
  daysInMonth,
  distributeCents,
  evaluateCohort,
  expenseCentsInWindow,
  formatMultiple,
  formatPayback,
  formatRoi,
  presentEconomics,
  receiptNetCents,
} = require('../lib/marketing/economics/calc.ts');
const { factsFromContract, mapReceiptRow } = require('../lib/marketing/economics/contract.ts');
const { disconnectedFacts, sampleCohortFacts } = require('../lib/marketing/economics/fixtures.ts');
const { formatMinor } = require('../lib/marketing/metrics.ts');

function july(feeCents = 100_000, horizon = 'realized') {
  return evaluateCohort(sampleCohortFacts(feeCents), 'meta', horizon);
}

test('July sample reconciles to the package totals', () => {
  const facts = sampleCohortFacts(100_000);
  assert.equal(facts.leads.length, 100);
  assert.equal(facts.receipts.length, 60);
  assert.equal(facts.receipts.reduce((sum, receipt) => sum + receipt.netCents, 0), 1_200_000);
  const result = evaluateCohort(facts, 'meta', 'realized');
  const expected = [
    ['media spend', 300_000, result.mediaSpendCents],
    ['fee', 100_000, result.feeCents],
    ['acquisition cost', 400_000, result.acquisitionCostCents],
    ['leads', 100, result.leadCount],
    ['payers', 20, result.acquiredFamilies],
    ['net collections', 1_200_000, result.netCollectionsCents],
    ['direct cost', 360_000, result.directCostCents],
    ['gross profit', 840_000, result.grossProfitCents],
    ['media CPL', 3_000, result.mediaCplCents],
    ['CAC', 20_000, result.cacCents],
    ['media ROAS', 4, result.mediaRoas],
    ['all-in return', 3, result.allInReturn],
    ['LTGP per family', 42_000, result.ltgpPerFamilyCents],
    ['LTGP:CAC', 2.1, result.ltgpToCac],
    ['contribution', 440_000, result.contributionCents],
    ['ROI', 1.1, result.roi],
  ];
  for (const [name, want, got] of expected) assert.equal(got, want, name);
  assert.equal(formatMultiple(result.mediaRoas), '4.00×');
  assert.equal(formatMultiple(result.allInReturn), '3.00×');
  assert.equal(formatMultiple(result.ltgpToCac), '2.10×');
  assert.equal(formatRoi(result.roi), '110%');
  assert.equal(formatMinor(result.contributionCents, 'USD'), '$4,400.00');
  assert.equal(result.payback.status, 'unavailable');
  const view = presentEconomics(facts, 'meta', 'realized');
  assert.equal(view.selected.payback.status, 'recovered');
  assert.equal(view.selected.payback.ageDays, 30);
  assert.equal(result.funnel.evaluationsBooked, 50);
  assert.equal(result.funnel.evaluationsAttended, 35);
  assert.equal(result.funnel.leadToPaid, 0.2);
});

test('raising the fee leaves media ROAS unchanged and moves the all-in figures', () => {
  const raised = presentEconomics(sampleCohortFacts(200_000), 'meta', 'realized').selected;
  assert.equal(raised.mediaRoas, 4);
  assert.equal(raised.cacCents, 25_000);
  assert.equal(raised.allInReturn, 2.4);
  assert.equal(raised.ltgpToCac, 1.68);
  assert.equal(raised.roi, 0.68);
  assert.equal(raised.contributionCents, 340_000);
  assert.equal(formatMultiple(raised.allInReturn), '2.40×');
  assert.equal(formatMultiple(raised.ltgpToCac), '1.68×');
  assert.equal(formatRoi(raised.roi), '68%');
  assert.equal(formatMinor(raised.contributionCents, 'USD'), '$3,400.00');
  assert.equal(raised.payback.status, 'recovered');
  assert.equal(raised.payback.ageDays, 90);
  assert.equal(formatPayback(raised.payback), 'Day 90');
});

test('horizon checkpoints match the sample curve', () => {
  const facts = sampleCohortFacts();
  const d30 = evaluateCohort(facts, 'meta', 'd30');
  const d90 = evaluateCohort(facts, 'meta', 'd90');
  assert.equal(d30.mature, true);
  assert.equal(d30.netCollectionsCents, 600_000);
  assert.equal(d30.directCostCents, 180_000);
  assert.equal(d30.grossProfitCents, 420_000);
  assert.equal(d30.ltgpPerFamilyCents, 21_000);
  assert.equal(d30.acquiredFamilies, 20);
  assert.equal(d90.netCollectionsCents, 1_000_000);
  assert.equal(d90.directCostCents, 300_000);
  assert.equal(d90.grossProfitCents, 700_000);
});

test('campaign rows plus unallocated equal the location totals', () => {
  const result = july();
  const rows = [...result.campaigns, result.unallocated];
  const sum = (pick) => rows.reduce((total, row) => total + pick(row), 0);
  assert.equal(sum((row) => row.mediaSpendCents), result.mediaSpendCents);
  assert.equal(sum((row) => row.feeCents), result.feeCents);
  assert.equal(sum((row) => row.leads), result.leadCount);
  assert.equal(sum((row) => row.acquiredFamilies), result.acquiredFamilies);
  assert.equal(sum((row) => row.netCollectionsCents), result.netCollectionsCents);
  const evalRow = result.campaigns.find((row) => row.name === 'Evaluation bookings');
  const summer = result.campaigns.find((row) => row.name === 'Summer skills');
  assert.equal(evalRow.feeCents, 60_000);
  assert.equal(summer.feeCents, 40_000);
  assert.equal(evalRow.leads, 60);
  assert.equal(summer.leads, 40);
  assert.equal(evalRow.acquiredFamilies, 13);
  assert.equal(summer.acquiredFamilies, 7);
  assert.equal(evalRow.netCollectionsCents, 780_000);
  assert.equal(summer.netCollectionsCents, 420_000);
  assert.equal(result.unallocated.mediaSpendCents, 0);
  assert.equal(result.unallocated.leads, 0);
  const averaged = ((evalRow.mediaRoas + summer.mediaRoas) / 2);
  assert.notEqual(averaged, result.mediaRoas);
});

test('a missing net is unavailable, and tax, refunds, and recoveries are applied once', () => {
  assert.equal(receiptNetCents({
    receiptId: 'g', familyId: 'f', locationId: 'l', kind: 'payment',
    grossCents: 10_000, taxCents: null, netCents: null, currency: 'USD', cashOn: '2026-07-20',
  }), null);
  assert.equal(receiptNetCents({
    receiptId: 't', familyId: 'f', locationId: 'l', kind: 'payment',
    grossCents: 10_001, taxCents: 1, netCents: null, currency: 'USD', cashOn: '2026-07-20',
  }), 10_000);
  assert.equal(receiptNetCents({
    receiptId: 'r', familyId: 'f', locationId: 'l', kind: 'refund',
    grossCents: 4_000, taxCents: 0, netCents: null, currency: 'USD', cashOn: '2026-08-01',
  }), -4_000);

  const facts = sampleCohortFacts();
  const family = 'family-01';
  facts.receipts.push(
    {
      receiptId: 'refund-1', familyId: family, locationId: facts.locationId, kind: 'refund',
      grossCents: 5_000, taxCents: 0, netCents: -5_000, currency: 'USD', cashOn: '2026-08-01',
    },
    {
      receiptId: 'chargeback-1', familyId: family, locationId: facts.locationId, kind: 'chargeback',
      grossCents: 2_000, taxCents: 0, netCents: null, currency: 'USD', cashOn: '2026-08-02',
    },
    {
      receiptId: 'recovery-1', familyId: family, locationId: facts.locationId, kind: 'recovery',
      grossCents: 2_000, taxCents: 500, netCents: null, currency: 'USD', cashOn: '2026-08-03',
    },
  );
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.netCollectionsCents, 1_200_000 - 5_000 - 2_000 + 1_500);
});

test('duplicate receipts are counted once and a null cash amount poisons the total', () => {
  const facts = sampleCohortFacts();
  const copy = { ...facts.receipts[0] };
  facts.receipts.push(copy);
  assert.equal(evaluateCohort(facts, 'meta', 'realized').netCollectionsCents, 1_200_000);

  facts.receipts.push({
    receiptId: 'unknown-tax', familyId: 'family-02', locationId: facts.locationId, kind: 'payment',
    grossCents: 9_999, taxCents: null, netCents: null, currency: 'USD', cashOn: '2026-08-01',
  });
  const poisoned = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(poisoned.netCollectionsCents, null);
  assert.equal(poisoned.mediaRoas, null);
  assert.notEqual(poisoned.netCollectionsCents, 0);
});

test('disconnected sources stay null instead of zero', () => {
  const result = evaluateCohort(disconnectedFacts(), 'meta', 'realized');
  for (const value of [
    result.mediaSpendCents, result.feeCents, result.acquisitionCostCents, result.leadCount,
    result.acquiredFamilies, result.netCollectionsCents, result.directCostCents, result.grossProfitCents,
    result.cacCents, result.mediaRoas, result.allInReturn, result.contributionCents, result.roi,
  ]) assert.equal(value, null);
  assert.equal(formatMinor(result.acquisitionCostCents, result.currency), 'unavailable');
  assert.equal(formatMultiple(result.mediaRoas), 'unavailable');
  assert.equal(formatRoi(result.roi), 'unavailable');
  assert.equal(formatPayback(result.payback), 'unavailable');
});

test('an empty connected source can be a real zero, and a zero denominator stays unavailable', () => {
  const organic = evaluateCohort(sampleCohortFacts(), 'organic', 'realized');
  assert.equal(organic.leadCount, 0);
  assert.equal(organic.acquiredFamilies, 0);
  assert.equal(organic.netCollectionsCents, 0);
  assert.equal(organic.mediaSpendCents, 0);
  assert.equal(organic.mediaRoas, null);
  assert.equal(organic.cacCents, null);

  const facts = sampleCohortFacts();
  facts.media = facts.media.map((row) => ({ ...row, spendCents: 0 }));
  facts.receipts = [];
  const quiet = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(quiet.leadCount, 100);
  assert.equal(quiet.acquiredFamilies, 0);
  assert.equal(quiet.netCollectionsCents, 0);
  assert.equal(quiet.mediaRoas, null);
  assert.equal(quiet.cacCents, null);
});

test('verified zero collections with positive spend are a real zero ROAS', () => {
  const facts = sampleCohortFacts();
  facts.receipts = [];
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.netCollectionsCents, 0);
  assert.equal(result.mediaRoas, 0);
  assert.equal(result.acquiredFamilies, 0);
});

test('duplicate leads, siblings, reactivations, and other locations do not inflate the cohort', () => {
  const facts = sampleCohortFacts();
  facts.leads.push({ ...facts.leads[0], leadId: facts.leads[0].leadId });
  facts.leads.push({
    ...facts.leads[0],
    leadId: 'lead-sibling',
    familyId: 'family-01',
    evaluationBooked: true,
    evaluationAttended: true,
  });
  facts.leads.push({
    ...facts.leads[0],
    leadId: 'lead-reactivation',
    familyId: 'family-old',
    isReactivation: true,
  });
  facts.receipts.push({
    receiptId: 'old-pay', familyId: 'family-old', locationId: facts.locationId, kind: 'payment',
    grossCents: 50_000, taxCents: 0, netCents: 50_000, currency: 'USD', cashOn: '2026-07-20',
  });
  facts.leads.push({
    ...facts.leads[0],
    leadId: 'lead-hidden',
    locationId: 'other-location',
    familyId: 'family-hidden',
  });
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.leadCount, 102);
  assert.equal(result.reactivations, 1);
  assert.equal(result.acquiredFamilies, 20);
  assert.equal(result.netCollectionsCents, 1_200_000);
});

test('a missing campaign stays unallocated and is not spread across campaigns', () => {
  const facts = sampleCohortFacts();
  facts.leads.push({
    leadId: 'lead-unmapped',
    locationId: facts.locationId,
    createdOn: '2026-07-16',
    channel: 'meta_form',
    metaCampaignId: null,
    metaAdsetId: null,
    metaAdId: null,
    familyId: 'family-unmapped',
    isReactivation: false,
    evaluationBooked: false,
    evaluationAttended: false,
  });
  facts.receipts.push({
    receiptId: 'unmapped-pay', familyId: 'family-unmapped', locationId: facts.locationId, kind: 'payment',
    grossCents: 40_000, taxCents: 0, netCents: 40_000, currency: 'USD', cashOn: '2026-07-20',
  });
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.unallocated.netCollectionsCents, 40_000);
  assert.equal(result.unallocated.acquiredFamilies, 1);
  const named = result.campaigns.reduce((total, row) => total + row.netCollectionsCents, 0);
  assert.equal(named, 1_200_000);
  assert.equal(named + result.unallocated.netCollectionsCents, result.netCollectionsCents);
});

test('no media spend leaves the fee unallocated', () => {
  const facts = sampleCohortFacts();
  facts.media = [
    { metaCampaignId: 'cmp_eval', campaignName: 'Evaluation bookings', spendCents: 0, currency: 'USD' },
    { metaCampaignId: 'cmp_summer', campaignName: 'Summer skills', spendCents: 0, currency: 'USD' },
  ];
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.campaigns.every((row) => row.feeCents === 0), true);
  assert.equal(result.unallocated.feeCents, 100_000);
  assert.equal(result.feeCents, 100_000);
  assert.equal(result.acquisitionCostCents, 100_000);
});

test('a media invoice is not added on top of Meta spend', () => {
  const facts = sampleCohortFacts();
  facts.expenses.push({
    id: 'media-invoice',
    category: 'media',
    amountCents: 50_000,
    currency: 'USD',
    cadence: 'one_time',
    serviceStart: '2026-07-01',
    serviceEnd: '2026-07-31',
    metaCampaignId: null,
    channel: 'meta',
  });
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.mediaSpendCents, 300_000);
  assert.equal(result.acquisitionCostCents, 400_000);
});

test('manual media spend is used only when Meta is not connected', () => {
  const facts = sampleCohortFacts();
  facts.mediaConnected = false;
  facts.media = [];
  facts.expenses.push({
    id: 'manual-media',
    category: 'media',
    amountCents: 300_000,
    currency: 'USD',
    cadence: 'one_time',
    serviceStart: '2026-07-01',
    serviceEnd: '2026-07-31',
    metaCampaignId: null,
    channel: 'meta',
  });
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.mediaSpendCents, 300_000);
  assert.equal(result.mediaRoas, 4);
});

test('an immature horizon is unavailable rather than zero', () => {
  const facts = sampleCohortFacts();
  facts.asOf = '2026-07-25';
  const d30 = evaluateCohort(facts, 'meta', 'd30');
  const realized = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(d30.mature, false);
  assert.equal(d30.netCollectionsCents, null);
  assert.equal(d30.acquiredFamilies, null);
  assert.equal(d30.leadCount, 100);
  assert.equal(realized.mature, true);
  assert.equal(realized.netCollectionsCents, 600_000);
  assert.equal(presentEconomics(facts, 'meta', 'realized').selected.payback.status, 'insufficient_history');
});

test('currency conflicts and cash at another location are unavailable', () => {
  const facts = sampleCohortFacts();
  facts.receipts[0] = { ...facts.receipts[0], currency: 'EUR' };
  assert.equal(evaluateCohort(facts, 'meta', 'realized').netCollectionsCents, null);

  const moved = sampleCohortFacts();
  moved.receipts[0] = { ...moved.receipts[0], locationId: 'other-location' };
  const result = evaluateCohort(moved, 'meta', 'realized');
  assert.equal(result.netCollectionsCents, null);
  assert.equal(result.notes.some((note) => note.includes('another location')), true);
});

test('negative contribution is a real result', () => {
  const facts = sampleCohortFacts(900_000);
  const result = presentEconomics(facts, 'meta', 'realized').selected;
  assert.equal(result.contributionCents, 840_000 - 1_200_000);
  assert.ok(result.roi < 0);
  assert.equal(result.payback.status, 'not_yet');
  assert.equal(formatPayback(result.payback), 'Not yet recovered');
});

test('retainer cents use the real month length and sum exactly', () => {
  const fee = {
    id: 'retainer',
    category: 'agency_retainer',
    amountCents: 100_000,
    currency: 'USD',
    cadence: 'recurring_monthly',
    serviceStart: '2026-02-01',
    serviceEnd: '2026-02-28',
    metaCampaignId: null,
    channel: 'meta',
  };
  assert.equal(daysInMonth(2026, 2), 28);
  const firstWeek = expenseCentsInWindow(fee, '2026-02-01', '2026-02-07');
  assert.equal(firstWeek, 25_004);
  assert.notEqual(firstWeek, Math.round((100_000 / 30) * 7));
  assert.equal(expenseCentsInWindow(fee, '2026-02-01', '2026-02-28'), 100_000);

  const march = { ...fee, serviceStart: '2026-03-01', serviceEnd: '2026-03-31' };
  assert.equal(daysInMonth(2026, 3), 31);
  assert.equal(expenseCentsInWindow(march, '2026-03-01', '2026-03-31'), 100_000);
  const shares = distributeCents(100_000, Array.from({ length: 31 }, () => 1));
  assert.equal(shares[0], 3_226);
  assert.equal(shares[30], 3_225);
  assert.equal(shares.reduce((sum, value) => sum + value, 0), 100_000);

  const januaryOld = expenseCentsInWindow({
    ...fee, amountCents: 310_000, serviceStart: '2026-01-01', serviceEnd: '2026-01-15',
  }, '2026-01-01', '2026-01-31');
  const januaryNew = expenseCentsInWindow({
    ...fee, amountCents: 620_000, serviceStart: '2026-01-16', serviceEnd: '2026-01-31',
  }, '2026-01-01', '2026-01-31');
  assert.equal(januaryOld, 150_000);
  assert.equal(januaryNew, 320_000);

  const facts = sampleCohortFacts();
  facts.expenses.push({ ...facts.expenses[0], id: 'overlap', serviceStart: '2026-07-15', serviceEnd: '2026-07-20' });
  assert.equal(evaluateCohort(facts, 'meta', 'realized').feeCents, null);
});

test('contract rows drop an unready origin and refuse to treat gross as net', () => {
  assert.equal(mapReceiptRow({
    receipt_id: 'gross-only', family_id: 'fam', location_id: 'loc', kind: 'payment',
    gross_cents: 12_000, tax_cents: null, net_cents: null, currency: 'USD',
    cash_at: '2026-07-20T12:00:00Z', contract_ready: true,
  }), null);
  const facts = factsFromContract({
    locationId: 'loc',
    locationLabel: 'Frisco Academy',
    cohortLabel: 'July 2026',
    cohortFrom: '2026-07-01',
    cohortTo: '2026-07-31',
    asOf: '2026-11-25',
    expenses: [],
    expensesReviewed: true,
    origins: [
      {
        lead_id: 'ready', location_id: 'loc', created_at: '2026-07-15T15:00:00.000Z', facility_tz: 'UTC',
        channel: 'meta_form', meta_campaign_id: 'cmp', meta_adset_id: null, meta_ad_id: null,
        family_id: 'fam', is_reactivation: false, contract_ready: true,
      },
      {
        lead_id: 'not-ready', location_id: 'loc', created_at: null, facility_tz: 'UTC',
        channel: null, meta_campaign_id: null, meta_adset_id: null, meta_ad_id: null,
        family_id: null, is_reactivation: null, contract_ready: false,
      },
    ],
    receipts: [
      {
        receipt_id: 'net', family_id: 'fam', location_id: 'loc', kind: 'payment',
        gross_cents: 12_000, tax_cents: 2_000, net_cents: 10_000, currency: 'USD',
        cash_at: '2026-07-20T12:00:00Z', contract_ready: true,
      },
    ],
  });
  const result = evaluateCohort(facts, 'meta', 'realized');
  assert.equal(result.leadCount, 1);
  assert.equal(result.acquiredFamilies, 1);
  assert.equal(result.netCollectionsCents, 10_000);
  assert.equal(result.grossProfitCents, null);
  assert.equal(result.mediaSpendCents, null);
  assert.equal(result.mediaRoas, null);
});

test('the phase 2 migration is present and does not write CRM or billing tables', () => {
  const sql = fs.readFileSync(path.resolve(portalRoot, '../supabase/migrations/20261126120000_marketing_phase2_read_contract.sql'), 'utf8');
  assert.match(sql, /NEEDS HARRY'S APPROVAL BEFORE APPLYING/);
  assert.doesNotMatch(sql, /ALTER TABLE public\.payment_events/i);
  assert.doesNotMatch(sql, /ALTER TABLE public\.crm_threads/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.payment_events/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.crm_threads/i);
});

test('null money formats as unavailable and a cleared fee does not become zero', () => {
  assert.equal(formatMinor(null, 'USD'), 'unavailable');
  assert.equal(formatMinor(0, 'USD'), '$0.00');
  const cleared = evaluateCohort(sampleCohortFacts(null), 'meta', 'realized');
  assert.equal(cleared.feeCents, null);
  assert.equal(cleared.acquisitionCostCents, null);
  assert.equal(cleared.cacCents, null);
  assert.equal(cleared.mediaRoas, 4);
  assert.equal(daysAfter('2026-07-15', '2026-11-25') >= 92, true);
});
