import 'server-only';

/**
 * Account-daily and campaign / ad set / ad insights.
 * Leads come only from `lead` and `onsite_conversion.lead_grouped`.
 * When both are present, the larger value is kept and they are not added:
 * Meta often reports the same on-Facebook leads under both types.
 * `conversions` and every other action type are ignored.
 * Reach is taken from the single aggregate row for that grain. It is never
 * summed across days or entities. CTR, CPC, and CPL are recomputed from the
 * numerators and denominators. cost_per_action_type and frequency are requested
 * so the call matches the reporting contract, and are not displayed as-is.
 *
 * account_timezone is not an Insights field (asking for it fails the call).
 * Timezone is read from the ad account node as timezone_name.
 */
import { ratioFromSums, sumNumbers, toMinorUnits, parseCount, unifyCurrency } from '../metrics';
import { ATTRIBUTION_WINDOWS, type EntityLevel, type MetricBlock } from '../types';
import { MetaGraphError, buildGraphUrl, graphGetAll, metaGraphFetch, type GraphClientOptions } from './graphClient';

const INSIGHT_FIELDS = [
  'spend',
  'impressions',
  'inline_link_clicks',
  'reach',
  'frequency',
  'actions',
  'cost_per_action_type',
  'account_currency',
  'date_start',
  'date_stop',
  'campaign_id',
  'campaign_name',
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
].join(',');

const LEAD_ACTION = 'lead';
const GROUPED_LEAD_ACTION = 'onsite_conversion.lead_grouped';

export interface RawAction {
  action_type?: string;
  value?: string;
}

export interface RawInsight {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  reach?: string;
  frequency?: string;
  actions?: RawAction[];
  /** Present on some payloads. Never counted as leads. */
  conversions?: string;
  ctr?: string;
  cpc?: string;
  cost_per_action_type?: RawAction[];
  account_currency?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
}

export interface ParsedInsight {
  date: string | null;
  spend_minor: number | null;
  currency: string | null;
  impressions: number | null;
  inline_link_clicks: number | null;
  leads: number | null;
  reach: number | null;
  entity_id: string | null;
  entity_name: string | null;
  parent_id: string | null;
}

export function extractLeads(actions: RawAction[] | null | undefined): number | null {
  if (!Array.isArray(actions)) return null;
  const values: number[] = [];
  for (const actionType of [GROUPED_LEAD_ACTION, LEAD_ACTION]) {
    const found = actions.find((action) => action?.action_type === actionType);
    if (!found || found.value === undefined || found.value === null || found.value === '') continue;
    const parsed = parseCount(found.value);
    if (parsed === null) return null;
    values.push(parsed);
  }
  if (values.length === 0) return null;
  return Math.max(...values);
}

export function parseInsightRow(row: RawInsight, level: 'account' | EntityLevel): ParsedInsight {
  const currency = typeof row.account_currency === 'string' && row.account_currency.trim()
    ? row.account_currency.trim().toUpperCase()
    : null;
  const identity = level === 'ad'
    ? { id: row.ad_id ?? null, name: row.ad_name ?? null, parent: row.adset_id ?? null }
    : level === 'adset'
      ? { id: row.adset_id ?? null, name: row.adset_name ?? null, parent: row.campaign_id ?? null }
      : level === 'campaign'
        ? { id: row.campaign_id ?? null, name: row.campaign_name ?? null, parent: null }
        : { id: null, name: null, parent: null };
  return {
    date: row.date_start ?? null,
    spend_minor: toMinorUnits(row.spend, currency),
    currency,
    impressions: parseCount(row.impressions),
    inline_link_clicks: parseCount(row.inline_link_clicks),
    leads: extractLeads(row.actions),
    reach: parseCount(row.reach),
    entity_id: identity.id,
    entity_name: identity.name,
    parent_id: identity.parent,
  };
}

export function toMetricBlock(parts: {
  spend_minor: number | null;
  impressions: number | null;
  inline_link_clicks: number | null;
  leads: number | null;
  reach: number | null;
}): MetricBlock {
  return {
    spend_minor: parts.spend_minor,
    impressions: parts.impressions,
    inline_link_clicks: parts.inline_link_clicks,
    leads: parts.leads,
    reach: parts.reach,
    link_ctr: ratioFromSums(parts.inline_link_clicks, parts.impressions),
    cpc_minor: ratioFromSums(parts.spend_minor, parts.inline_link_clicks),
    cpl_minor: ratioFromSums(parts.spend_minor, parts.leads),
    frequency: ratioFromSums(parts.impressions, parts.reach),
  };
}

export interface AccountReportParts {
  daily: ParsedInsight[];
  /** One row covering the whole window. Reach is read only from here. */
  aggregate: ParsedInsight[];
  campaigns: ParsedInsight[];
  dailyIncomplete: boolean;
  aggregateIncomplete: boolean;
  campaignsIncomplete: boolean;
}

export interface BuiltAccountReport {
  summary: MetricBlock;
  daily: Array<MetricBlock & { date: string }>;
  entities: Array<MetricBlock & { id: string; name: string; level: EntityLevel; parent_id: string | null }>;
  currency: string | null;
  incomplete: boolean;
}

function summedAdditive(rows: ParsedInsight[]): {
  spend_minor: number | null;
  impressions: number | null;
  inline_link_clicks: number | null;
  leads: number | null;
  currency: string | null;
} {
  const currency = unifyCurrency(rows.map((row) => row.currency));
  const spend = currency === null && rows.some((row) => row.spend_minor !== null)
    ? null
    : sumNumbers(rows.map((row) => row.spend_minor), 'zero');
  return {
    spend_minor: spend,
    impressions: sumNumbers(rows.map((row) => row.impressions), 'zero'),
    inline_link_clicks: sumNumbers(rows.map((row) => row.inline_link_clicks), 'zero'),
    leads: sumNumbers(rows.map((row) => row.leads), 'null'),
    currency,
  };
}

/**
 * Window totals prefer the single aggregate insights row (Meta's own sum for
 * that grain). Ratios are still recomputed here. If that row is missing,
 * additive metrics are the sums of the daily rows. Reach is never the sum
 * of daily reach or of campaign reach.
 */
export function buildAccountReport(parts: AccountReportParts): BuiltAccountReport {
  const currencies = [
    ...parts.aggregate.map((row) => row.currency),
    ...parts.daily.map((row) => row.currency),
    ...parts.campaigns.map((row) => row.currency),
  ];
  const currency = unifyCurrency(currencies);
  const currencyConflict = currencies.some(Boolean) && currency === null;
  const dailySums = summedAdditive(parts.daily);
  const aggregate = parts.aggregate.length === 1 ? parts.aggregate[0] : null;
  const extraAggregateRows = parts.aggregate.length > 1;
  const additives = aggregate
    ? {
        spend_minor: currencyConflict ? null : aggregate.spend_minor,
        impressions: aggregate.impressions,
        inline_link_clicks: aggregate.inline_link_clicks,
        leads: aggregate.leads,
      }
    : {
        spend_minor: currencyConflict ? null : dailySums.spend_minor,
        impressions: dailySums.impressions,
        inline_link_clicks: dailySums.inline_link_clicks,
        leads: dailySums.leads,
      };
  const reach = aggregate && !extraAggregateRows ? aggregate.reach : null;
  const summary = toMetricBlock({ ...additives, reach });
  const daily = parts.daily
    .filter((row) => row.date)
    .map((row) => ({
      date: row.date as string,
      ...toMetricBlock({
        spend_minor: row.spend_minor,
        impressions: row.impressions,
        inline_link_clicks: row.inline_link_clicks,
        leads: row.leads,
        reach: row.reach,
      }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const entities = parts.campaigns
    .filter((row) => row.entity_id)
    .map((row) => ({
      id: row.entity_id as string,
      name: row.entity_name?.trim() || 'Untitled',
      level: 'campaign' as const,
      parent_id: row.parent_id,
      ...toMetricBlock({
        spend_minor: row.spend_minor,
        impressions: row.impressions,
        inline_link_clicks: row.inline_link_clicks,
        leads: row.leads,
        reach: row.reach,
      }),
    }))
    .sort((a, b) => (b.spend_minor ?? -1) - (a.spend_minor ?? -1));

  return {
    summary,
    daily,
    entities,
    currency,
    incomplete: parts.dailyIncomplete || parts.aggregateIncomplete || parts.campaignsIncomplete || extraAggregateRows,
  };
}

export function entityRows(rows: ParsedInsight[], level: EntityLevel): BuiltAccountReport['entities'] {
  return rows
    .filter((row) => row.entity_id)
    .map((row) => ({
      id: row.entity_id as string,
      name: row.entity_name?.trim() || 'Untitled',
      level,
      parent_id: row.parent_id,
      ...toMetricBlock({
        spend_minor: row.spend_minor,
        impressions: row.impressions,
        inline_link_clicks: row.inline_link_clicks,
        leads: row.leads,
        reach: row.reach,
      }),
    }))
    .sort((a, b) => (b.spend_minor ?? -1) - (a.spend_minor ?? -1));
}

export interface AccountProfile {
  timezone: string | null;
  currency: string | null;
  name: string | null;
}

function insightQuery(level: string, from: string, to: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    level,
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since: from, until: to }),
    action_attribution_windows: JSON.stringify([...ATTRIBUTION_WINDOWS]),
    limit: '100',
    ...extra,
  };
}

async function readInsights(accountId: string, params: Record<string, string>, options?: GraphClientOptions) {
  const url = buildGraphUrl(`${accountId}/insights`, params);
  return graphGetAll<RawInsight>(url, options);
}

/** The ad account node is one object, not a paged insights `data` array. */
export async function fetchAccountNode(accountId: string, options?: GraphClientOptions): Promise<AccountProfile> {
  const url = buildGraphUrl(accountId, { fields: 'timezone_name,currency,name' });
  const response = await metaGraphFetch(url, { method: 'GET' }, options);
  const body = await response.json() as { timezone_name?: string; currency?: string; name?: string; error?: { code?: number } };
  if (body.error) {
    throw new MetaGraphError('Meta ad account could not be read', {
      code: typeof body.error.code === 'number' ? body.error.code : null,
    });
  }
  return {
    timezone: typeof body.timezone_name === 'string' ? body.timezone_name : null,
    currency: typeof body.currency === 'string' ? body.currency.toUpperCase() : null,
    name: typeof body.name === 'string' ? body.name : null,
  };
}

export interface LiveAccountBundle {
  profile: AccountProfile;
  report: BuiltAccountReport;
}

export async function fetchAccountBundle(
  accountId: string,
  from: string,
  to: string,
  options?: GraphClientOptions,
  profile?: AccountProfile,
): Promise<LiveAccountBundle> {
  const [profileResult, dailyPage, aggregatePage, campaignPage] = await Promise.all([
    profile ? Promise.resolve(profile) : fetchAccountNode(accountId, options).catch(() => ({ timezone: null, currency: null, name: null })),
    readInsights(accountId, insightQuery('account', from, to, { time_increment: '1' }), options),
    readInsights(accountId, insightQuery('account', from, to), options),
    readInsights(accountId, insightQuery('campaign', from, to), options),
  ]);
  const daily = dailyPage.rows.map((row) => parseInsightRow(row, 'account'));
  const aggregate = aggregatePage.rows.map((row) => parseInsightRow(row, 'account'));
  const campaigns = campaignPage.rows.map((row) => parseInsightRow(row, 'campaign'));
  const report = buildAccountReport({
    daily,
    aggregate,
    campaigns,
    dailyIncomplete: dailyPage.incomplete,
    aggregateIncomplete: aggregatePage.incomplete,
    campaignsIncomplete: campaignPage.incomplete,
  });
  if (!report.currency && profileResult.currency) report.currency = profileResult.currency;
  return { profile: profileResult, report };
}

export async function fetchChildEntities(
  accountId: string,
  from: string,
  to: string,
  level: 'adset' | 'ad',
  parentId: string,
  options?: GraphClientOptions,
): Promise<{ entities: BuiltAccountReport['entities']; incomplete: boolean; currency: string | null }> {
  const field = level === 'adset' ? 'campaign.id' : 'adset.id';
  const page = await readInsights(accountId, insightQuery(level, from, to, {
    filtering: JSON.stringify([{ field, operator: 'EQUAL', value: parentId }]),
  }), options);
  const parsed = page.rows.map((row) => parseInsightRow(row, level));
  return {
    entities: entityRows(parsed, level),
    incomplete: page.incomplete,
    currency: unifyCurrency(parsed.map((row) => row.currency)),
  };
}
