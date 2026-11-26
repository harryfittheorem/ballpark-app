/**
 * Deterministic sample insights. Never reads META_SYSTEM_USER_TOKEN and never
 * attaches a real ad account id. The Nov 19–25 2026 week is a fixed series so
 * screenshots and the ratio tests stay stable.
 */
import { eachIsoDate, yesterdayInTimeZone, windowIncludesOpenDay } from '../metrics';
import {
  ATTRIBUTION_LABEL,
  ATTRIBUTION_WINDOWS,
  SAMPLE_LABEL,
  type EntityLevel,
  type EntityRow,
  type MarketingLocation,
  type MarketingMetaResponse,
  type MetricBlock,
} from '../types';
import { toMetricBlock } from './insights';

export const FIXTURE_TIMEZONE = 'America/Chicago';
export const FIXTURE_CURRENCY = 'USD';

const CANONICAL_REACH = 12_800;
const CANONICAL: Record<string, DailySeed> = {
  '2026-11-19': { spend: 4200, impressions: 3100, clicks: 62, leads: 5, reach: 2400 },
  '2026-11-20': { spend: 3800, impressions: 2800, clicks: 48, leads: 4, reach: 2100 },
  '2026-11-21': { spend: 5100, impressions: 3600, clicks: 71, leads: 6, reach: 2700 },
  '2026-11-22': { spend: 4600, impressions: 3300, clicks: 55, leads: 4, reach: 2500 },
  '2026-11-23': { spend: 2900, impressions: 2100, clicks: 33, leads: 2, reach: 1600 },
  '2026-11-24': { spend: 5400, impressions: 3900, clicks: 80, leads: 7, reach: 3000 },
  '2026-11-25': { spend: 4000, impressions: 2700, clicks: 51, leads: 4, reach: 2000 },
};

interface DailySeed {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  reach: number;
}

interface NodeSeed {
  id: string;
  name: string;
  weight: number;
  adsets?: AdSetSeed[];
  ads?: AdSeed[];
}

interface AdSetSeed extends NodeSeed {
  ads: AdSeed[];
}

interface AdSeed {
  id: string;
  name: string;
  weight: number;
}

const CAMPAIGNS: NodeSeed[] = [
  {
    id: '23851000000000001',
    name: 'Evaluation bookings',
    weight: 60,
    adsets: [
      {
        id: '23852000000000001',
        name: 'Parents 25–44',
        weight: 70,
        ads: [
          { id: '23853000000000001', name: 'Cage session video', weight: 60 },
          { id: '23853000000000002', name: 'Free eval carousel', weight: 40 },
        ],
      },
      {
        id: '23852000000000002',
        name: 'Site visitors',
        weight: 30,
        ads: [{ id: '23853000000000003', name: 'Retarget static', weight: 100 }],
      },
    ],
  },
  {
    id: '23851000000000002',
    name: 'Summer skills',
    weight: 40,
    adsets: [
      {
        id: '23852000000000003',
        name: 'Prospecting 10U–14U',
        weight: 100,
        ads: [{ id: '23853000000000004', name: 'Skills clinic', weight: 100 }],
      },
    ],
  },
];

function hashDate(iso: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < iso.length; i += 1) {
    hash ^= iso.charCodeAt(i);
    hash = Math.imul(hash, 1_677_7619);
  }
  return hash >>> 0;
}

function seedFor(date: string): DailySeed {
  const known = CANONICAL[date];
  if (known) return known;
  const hash = hashDate(date);
  const impressions = 1800 + (hash % 2200);
  return {
    spend: 2200 + (hash % 3800),
    impressions,
    clicks: 24 + (hash % 60),
    leads: hash % 6,
    reach: Math.max(1, Math.round(impressions * 0.72)),
  };
}

function splitInts(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const parts: number[] = [];
  let used = 0;
  weights.forEach((weight, index) => {
    if (index === weights.length - 1) {
      parts.push(total - used);
      return;
    }
    const part = Math.round((total * weight) / weightSum);
    parts.push(part);
    used += part;
  });
  return parts;
}

function reachBeside(parentReach: number, index: number): number {
  const scaled = Math.max(1, Math.round(parentReach * (0.55 + index * 0.12)));
  return scaled === parentReach ? Math.max(1, scaled - 1) : scaled;
}

function block(seed: { spend: number; impressions: number; clicks: number; leads: number }, reach: number): MetricBlock {
  return toMetricBlock({
    spend_minor: seed.spend,
    impressions: seed.impressions,
    inline_link_clicks: seed.clicks,
    leads: seed.leads,
    reach,
  });
}

interface Tree {
  summary: MetricBlock;
  daily: Array<MetricBlock & { date: string }>;
  campaigns: EntityRow[];
  adsets: EntityRow[];
  ads: EntityRow[];
  summedDailyReach: number;
}

function buildTree(from: string, to: string): Tree {
  const dates = eachIsoDate(from, to);
  const seeds = dates.map((date) => ({ date, ...seedFor(date) }));
  const totals = seeds.reduce((sum, day) => ({
    spend: sum.spend + day.spend,
    impressions: sum.impressions + day.impressions,
    clicks: sum.clicks + day.clicks,
    leads: sum.leads + day.leads,
    reach: sum.reach + day.reach,
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0 });
  const canonical = dates.length === 7 && dates.every((date) => CANONICAL[date]);
  let windowReach = canonical
    ? CANONICAL_REACH
    : Math.max(1, Math.round(totals.impressions * 0.62));
  if (windowReach === totals.reach) windowReach = Math.max(1, windowReach - 1);

  const campaignWeights = CAMPAIGNS.map((campaign) => campaign.weight);
  const spendParts = splitInts(totals.spend, campaignWeights);
  const impressionParts = splitInts(totals.impressions, campaignWeights);
  const clickParts = splitInts(totals.clicks, campaignWeights);
  const leadParts = splitInts(totals.leads, campaignWeights);
  const campaigns: EntityRow[] = [];
  const adsets: EntityRow[] = [];
  const ads: EntityRow[] = [];

  CAMPAIGNS.forEach((campaign, campaignIndex) => {
    const campaignSeed = {
      spend: spendParts[campaignIndex] ?? 0,
      impressions: impressionParts[campaignIndex] ?? 0,
      clicks: clickParts[campaignIndex] ?? 0,
      leads: leadParts[campaignIndex] ?? 0,
    };
    const campaignReach = reachBeside(windowReach, campaignIndex);
    campaigns.push({
      id: campaign.id,
      name: campaign.name,
      level: 'campaign',
      parent_id: null,
      ...block(campaignSeed, campaignReach),
    });
    const adsetList = campaign.adsets ?? [];
    const adsetWeights = adsetList.map((adset) => adset.weight);
    const adsetSpend = splitInts(campaignSeed.spend, adsetWeights);
    const adsetImpr = splitInts(campaignSeed.impressions, adsetWeights);
    const adsetClicks = splitInts(campaignSeed.clicks, adsetWeights);
    const adsetLeads = splitInts(campaignSeed.leads, adsetWeights);
    adsetList.forEach((adset, adsetIndex) => {
      const adsetSeed = {
        spend: adsetSpend[adsetIndex] ?? 0,
        impressions: adsetImpr[adsetIndex] ?? 0,
        clicks: adsetClicks[adsetIndex] ?? 0,
        leads: adsetLeads[adsetIndex] ?? 0,
      };
      adsets.push({
        id: adset.id,
        name: adset.name,
        level: 'adset',
        parent_id: campaign.id,
        ...block(adsetSeed, reachBeside(campaignReach, adsetIndex)),
      });
      const adWeights = adset.ads.map((ad) => ad.weight);
      const adSpend = splitInts(adsetSeed.spend, adWeights);
      const adImpr = splitInts(adsetSeed.impressions, adWeights);
      const adClicks = splitInts(adsetSeed.clicks, adWeights);
      const adLeads = splitInts(adsetSeed.leads, adWeights);
      adset.ads.forEach((ad, adIndex) => {
        ads.push({
          id: ad.id,
          name: ad.name,
          level: 'ad',
          parent_id: adset.id,
          ...block({
            spend: adSpend[adIndex] ?? 0,
            impressions: adImpr[adIndex] ?? 0,
            clicks: adClicks[adIndex] ?? 0,
            leads: adLeads[adIndex] ?? 0,
          }, reachBeside(reachBeside(campaignReach, adsetIndex), adIndex)),
        });
      });
    });
  });

  return {
    summary: block(totals, windowReach),
    daily: seeds.map((day) => ({
      date: day.date,
      ...block(day, day.reach),
    })),
    campaigns,
    adsets,
    ads,
    summedDailyReach: totals.reach,
  };
}

function sampleLocations(locations: MarketingLocation[]): MarketingLocation[] {
  const source = locations.length > 0 ? locations : [{
    id: '00000000-0000-4000-8000-0000000000a1',
    name: 'Sample location',
    ad_account_id: null,
    connection: 'sample' as const,
  }];
  return source.map((location) => ({
    id: location.id,
    name: location.name,
    ad_account_id: null,
    connection: 'sample',
  }));
}

export function fixtureResponse(input: {
  locations: MarketingLocation[];
  locationId: string | null;
  from: string;
  to: string;
  level: EntityLevel;
  parent: string | null;
  now?: Date;
}): MarketingMetaResponse {
  const now = input.now ?? new Date();
  const locations = sampleLocations(input.locations);
  const locationId = input.locationId && locations.some((location) => location.id === input.locationId)
    ? input.locationId
    : locations[0]?.id ?? null;
  const tree = buildTree(input.from, input.to);
  const entities = input.level === 'ad'
    ? tree.ads.filter((row) => row.parent_id === input.parent)
    : input.level === 'adset'
      ? tree.adsets.filter((row) => row.parent_id === input.parent)
      : tree.campaigns;
  const lastComplete = yesterdayInTimeZone(FIXTURE_TIMEZONE, now);
  return {
    mode: 'sample',
    location_id: locationId,
    locations,
    connection: 'sample',
    ad_account_id: null,
    ad_account_label: 'Sample account',
    window: { from: input.from, to: input.to },
    last_complete_date: lastComplete,
    window_includes_open_day: windowIncludesOpenDay(input.to, lastComplete),
    fetched_at: now.toISOString(),
    incomplete: false,
    currency: FIXTURE_CURRENCY,
    timezone: FIXTURE_TIMEZONE,
    timezone_note: null,
    attribution: [...ATTRIBUTION_WINDOWS],
    attribution_label: ATTRIBUTION_LABEL,
    graph_version: null,
    summary: input.level === 'campaign' ? tree.summary : null,
    daily: input.level === 'campaign' ? tree.daily : [],
    entities,
    entity_level: input.level,
    config_error: null,
    shared_account: false,
    note: SAMPLE_LABEL,
  };
}

/** Exposed for the reach test: daily reach summed across the canonical week. */
export function canonicalDailyReachSum(): number {
  return Object.values(CANONICAL).reduce((sum, day) => sum + day.reach, 0);
}
