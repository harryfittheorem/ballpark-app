import { NextResponse } from 'next/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { listAuthorizedLocations } from '@/lib/marketing/accounts';
import { factsFromContract, mapExpenseRow } from '@/lib/marketing/economics/contract';
import { presentEconomics } from '@/lib/marketing/economics/calc';
import { disconnectedFacts, sampleCohortFacts } from '@/lib/marketing/economics/fixtures';
import type { EconomicsSource, Horizon } from '@/lib/marketing/economics/types';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function horizonOf(value: string | null): Horizon {
  if (value === 'd30' || value === 'd90' || value === 'realized') return value;
  return 'realized';
}

function sourceOf(value: string | null): EconomicsSource {
  if (value === 'meta' || value === 'organic' || value === 'referral' || value === 'unknown' || value === 'all') return value;
  return 'meta';
}

function feeOf(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  if (!/^\d+$/.test(value)) return 100_000;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 100_000;
}

export async function GET(request: Request) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const { data: { session } } = await client.auth.getSession();
  if (!user || !session) return json({ error: 'Sign in required' }, 401);
  if (readAppRole(session) !== 'owner') return json({ error: 'Owner access required' }, 403);
  const tenantId = readTenantId(session);
  if (!tenantId) return json({ error: 'Owner access required' }, 403);

  const url = new URL(request.url);
  const horizon = horizonOf(url.searchParams.get('horizon'));
  const source = sourceOf(url.searchParams.get('source'));
  if (url.searchParams.get('preview') === '1') {
    return json(presentEconomics(sampleCohortFacts(feeOf(url.searchParams.get('fee_cents'))), source, horizon));
  }

  let locations;
  try {
    locations = await listAuthorizedLocations(client, user.id, tenantId);
  } catch {
    return json({ error: 'Could not load authorized locations' }, 500);
  }
  const requested = url.searchParams.get('location');
  if (requested && !locations.some((location) => location.id === requested)) {
    return json({ error: 'Location not authorized' }, 403);
  }
  const location = locations.find((item) => item.id === requested) ?? locations[0] ?? null;
  const facts = disconnectedFacts();
  if (location) {
    facts.locationId = location.id;
    facts.locationLabel = location.name;
  }

  const health = await client.rpc('mkt_contract_health_v1');
  const row = Array.isArray(health.data) ? health.data[0] : health.data;
  const leadsReady = !health.error && row?.lead_origin_ready === true;
  const receiptsReady = !health.error && row?.receipts_ready === true;
  if (!location || !leadsReady || !receiptsReady) {
    return json(presentEconomics(facts, source, horizon));
  }

  const [origins, receipts, expenses] = await Promise.all([
    client.from('mkt_lead_origins_v1').select('lead_id, location_id, created_at, facility_tz, channel, meta_campaign_id, meta_adset_id, meta_ad_id, family_id, is_reactivation, contract_ready').eq('location_id', location.id),
    client.from('mkt_receipts_v1').select('receipt_id, family_id, location_id, kind, gross_cents, tax_cents, net_cents, currency, cash_at, contract_ready').eq('location_id', location.id),
    client.from('mkt_acquisition_expenses').select('id, category, amount_cents, currency, cadence, service_start, service_end, meta_campaign_id, channel, approved_at').eq('location_id', location.id),
  ]);
  if (origins.error || receipts.error || expenses.error) {
    return json(presentEconomics(facts, source, horizon));
  }
  const approved = (expenses.data ?? []).flatMap((expense) => {
    if (!expense.approved_at) return [];
    const mapped = mapExpenseRow(expense);
    return mapped ? [mapped] : [];
  });
  const cohort = url.searchParams.get('cohort');
  if (!cohort || !/^\d{4}-\d{2}$/.test(cohort)) return json(presentEconomics(facts, source, horizon));
  const cohortFrom = `${cohort}-01`;
  const cohortTo = new Date(Date.UTC(Number(cohort.slice(0, 4)), Number(cohort.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const live = factsFromContract({
    locationId: location.id,
    locationLabel: location.name,
    cohortLabel: cohort,
    cohortFrom,
    cohortTo,
    asOf: new Date().toISOString().slice(0, 10),
    origins: origins.data ?? [],
    receipts: receipts.data ?? [],
    expenses: approved,
    expensesReviewed: approved.length > 0,
  });
  return json(presentEconomics(live, source, horizon));
}
