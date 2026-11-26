import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import {
  accountForLocation,
  accountIsShared,
  listAuthorizedLocations,
  parseAdAccountMap,
  reportingMode,
  type AuthorizedLocation,
} from '@/lib/marketing/accounts';
import { resolveWindow, windowIncludesOpenDay, yesterdayInTimeZone } from '@/lib/marketing/metrics';
import { FIXTURE_TIMEZONE, fixtureResponse } from '@/lib/marketing/meta/fixtures';
import { MetaGraphError, graphApiVersion } from '@/lib/marketing/meta/graphClient';
import { fetchAccountBundle, fetchAccountNode, fetchChildEntities } from '@/lib/marketing/meta/insights';
import { createClient } from '@/lib/supabase/server';
import {
  ATTRIBUTION_LABEL,
  ATTRIBUTION_WINDOWS,
  type EntityLevel,
  type MarketingLocation,
  type MarketingMetaResponse,
} from '@/lib/marketing/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const loadProfile = unstable_cache(
  async (accountId: string) => fetchAccountNode(accountId),
  ['owner-marketing-meta-profile-v1'],
  { revalidate: 900 },
);

const loadAccountBundle = unstable_cache(
  async (accountId: string, from: string, to: string, profileJson: string) => {
    const profile = JSON.parse(profileJson) as { timezone: string | null; currency: string | null; name: string | null };
    const bundle = await fetchAccountBundle(accountId, from, to, undefined, profile);
    return { bundle, fetched_at: new Date().toISOString() };
  },
  ['owner-marketing-meta-account-v1'],
  { revalidate: 900 },
);

const loadChildren = unstable_cache(
  async (accountId: string, from: string, to: string, level: string, parent: string) => {
    const entities = await fetchChildEntities(accountId, from, to, level === 'ad' ? 'ad' : 'adset', parent);
    return { entities, fetched_at: new Date().toISOString() };
  },
  ['owner-marketing-meta-children-v1'],
  { revalidate: 900 },
);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const { data: { session } } = await client.auth.getSession();
  if (!user || !session) return json({ error: 'Sign in required' }, 401);
  if (readAppRole(session) !== 'owner') return json({ error: 'Owner access required' }, 403);
  const tenantId = readTenantId(session);
  if (!tenantId) return json({ error: 'Owner access required' }, 403);

  let locations: AuthorizedLocation[];
  try {
    locations = await listAuthorizedLocations(client, user.id, tenantId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Could not verify staff location grants' || message === 'Could not load authorized locations') {
      return json({ error: message }, 500);
    }
    return json({ error: 'Could not load authorized locations' }, 500);
  }

  const url = new URL(request.url);
  const requestedLocation = url.searchParams.get('location');
  if (requestedLocation && !locations.some((location) => location.id === requestedLocation)) {
    return json({ error: 'Location not authorized' }, 403);
  }
  const location = locations.find((item) => item.id === requestedLocation) ?? locations[0] ?? null;
  const levelParam = url.searchParams.get('level');
  const level: EntityLevel = levelParam === 'ad' || levelParam === 'adset' ? levelParam : 'campaign';
  const parent = url.searchParams.get('parent');
  if (level !== 'campaign' && !parent) return json({ error: 'A parent id is required for this drill' }, 400);
  const preview = url.searchParams.get('preview') === '1';
  const mode = reportingMode(preview);
  const now = new Date();
  const preset = url.searchParams.get('preset');
  const hasCustom = url.searchParams.has('from') || url.searchParams.has('to');

  if (mode === 'sample') {
    const windowResult = resolveWindow({
      preset: hasCustom ? null : (preset ?? '7'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      timeZone: FIXTURE_TIMEZONE,
      now,
    });
    if ('error' in windowResult) return json({ error: windowResult.error }, 400);
    const sampleLocations: MarketingLocation[] = locations.map((item) => ({
      id: item.id,
      name: item.name,
      ad_account_id: null,
      connection: 'sample',
    }));
    return json(fixtureResponse({
      locations: sampleLocations,
      locationId: location?.id ?? null,
      from: windowResult.from,
      to: windowResult.to,
      level,
      parent,
      now,
    }));
  }

  const parsedMap = parseAdAccountMap(process.env.META_AD_ACCOUNT_MAP);
  const accountId = location ? accountForLocation(location.id, parsedMap.map) : null;
  if (parsedMap.error || !location || !accountId) {
    const zone = location?.timezone ?? null;
    const windowResult = resolveWindow({
      preset: hasCustom ? null : (preset ?? '7'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      timeZone: zone,
      now,
    });
    if ('error' in windowResult) return json({ error: windowResult.error }, 400);
    return json(disconnectedResponse({
      locations,
      location,
      map: parsedMap.map,
      from: windowResult.from,
      to: windowResult.to,
      level,
      configError: parsedMap.error,
      usedUtcFallback: windowResult.usedUtcFallback,
      now,
    }));
  }

  if (level !== 'campaign' && !/^\d+$/.test(parent ?? '')) {
    return json({ error: 'Parent id is not a Meta object id' }, 400);
  }

  let profile: { timezone: string | null; currency: string | null; name: string | null };
  try {
    profile = await loadProfile(accountId);
  } catch (error) {
    if (error instanceof MetaGraphError) return json({ error: error.message }, 502);
    profile = { timezone: null, currency: null, name: null };
  }

  const windowResult = resolveWindow({
    preset: hasCustom ? null : (preset ?? '7'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    timeZone: profile.timezone,
    now,
  });
  if ('error' in windowResult) return json({ error: windowResult.error }, 400);

  try {
    if (level === 'campaign') {
      const loaded = await loadAccountBundle(accountId, windowResult.from, windowResult.to, JSON.stringify(profile));
      return json(connectedResponse({
        locations,
        location,
        accountId,
        map: parsedMap.map,
        from: windowResult.from,
        to: windowResult.to,
        level,
        profile,
        summary: loaded.bundle.report.summary,
        daily: loaded.bundle.report.daily,
        entities: loaded.bundle.report.entities,
        currency: loaded.bundle.report.currency ?? profile.currency,
        incomplete: loaded.bundle.report.incomplete,
        fetchedAt: loaded.fetched_at,
        usedUtcFallback: windowResult.usedUtcFallback,
        now,
      }));
    }
    const loaded = await loadChildren(accountId, windowResult.from, windowResult.to, level, parent ?? '');
    return json(connectedResponse({
      locations,
      location,
      accountId,
      map: parsedMap.map,
      from: windowResult.from,
      to: windowResult.to,
      level,
      profile,
      summary: null,
      daily: [],
      entities: loaded.entities.entities,
      currency: loaded.entities.currency ?? profile.currency,
      incomplete: loaded.entities.incomplete,
      fetchedAt: loaded.fetched_at,
      usedUtcFallback: windowResult.usedUtcFallback,
      now,
    }));
  } catch (error) {
    if (error instanceof MetaGraphError) return json({ error: error.message }, 502);
    return json({ error: 'Meta Insights could not be loaded' }, 502);
  }
}

function locationRows(locations: AuthorizedLocation[], map: Record<string, string>): MarketingLocation[] {
  return locations.map((location) => {
    const adAccountId = accountForLocation(location.id, map);
    return {
      id: location.id,
      name: location.name,
      ad_account_id: adAccountId,
      connection: adAccountId ? 'connected' : 'not_connected',
    };
  });
}

function disconnectedResponse(input: {
  locations: AuthorizedLocation[];
  location: AuthorizedLocation | null;
  map: Record<string, string>;
  from: string;
  to: string;
  level: EntityLevel;
  configError: string | null;
  usedUtcFallback: boolean;
  now: Date;
}): MarketingMetaResponse {
  const zone = input.location?.timezone ?? null;
  const lastComplete = zone ? yesterdayInTimeZone(zone, input.now) : null;
  return {
    mode: 'live',
    location_id: input.location?.id ?? null,
    locations: locationRows(input.locations, input.map),
    connection: 'not_connected',
    ad_account_id: null,
    ad_account_label: 'Not connected',
    window: { from: input.from, to: input.to },
    last_complete_date: lastComplete,
    window_includes_open_day: windowIncludesOpenDay(input.to, lastComplete),
    fetched_at: input.now.toISOString(),
    incomplete: false,
    currency: null,
    timezone: zone,
    timezone_note: input.configError
      ? 'Ad account mapping is not configured correctly.'
      : zone
        ? 'Location timezone. This location is not connected to an ad account.'
        : input.usedUtcFallback
          ? 'Date presets used UTC because no account timezone is available.'
          : null,
    attribution: [...ATTRIBUTION_WINDOWS],
    attribution_label: ATTRIBUTION_LABEL,
    graph_version: graphApiVersion(),
    summary: null,
    daily: [],
    entities: [],
    entity_level: input.level,
    config_error: input.configError,
    shared_account: false,
    note: null,
  };
}

function connectedResponse(input: {
  locations: AuthorizedLocation[];
  location: AuthorizedLocation;
  accountId: string;
  map: Record<string, string>;
  from: string;
  to: string;
  level: EntityLevel;
  profile: { timezone: string | null; currency: string | null; name: string | null };
  summary: MarketingMetaResponse['summary'];
  daily: MarketingMetaResponse['daily'];
  entities: MarketingMetaResponse['entities'];
  currency: string | null;
  incomplete: boolean;
  fetchedAt: string;
  usedUtcFallback: boolean;
  now: Date;
}): MarketingMetaResponse {
  const shared = accountIsShared(input.accountId, input.map);
  const lastComplete = input.profile.timezone ? yesterdayInTimeZone(input.profile.timezone, input.now) : null;
  return {
    mode: 'live',
    location_id: input.location.id,
    locations: locationRows(input.locations, input.map),
    connection: 'connected',
    ad_account_id: input.accountId,
    ad_account_label: input.accountId,
    window: { from: input.from, to: input.to },
    last_complete_date: lastComplete,
    window_includes_open_day: windowIncludesOpenDay(input.to, lastComplete),
    fetched_at: input.fetchedAt,
    incomplete: input.incomplete,
    currency: input.currency,
    timezone: input.profile.timezone,
    timezone_note: input.profile.timezone
      ? null
      : input.usedUtcFallback
        ? 'Date presets used UTC because the ad account timezone was unavailable.'
        : 'Ad account timezone was unavailable. Daily totals were not rebucketed.',
    attribution: [...ATTRIBUTION_WINDOWS],
    attribution_label: ATTRIBUTION_LABEL,
    graph_version: graphApiVersion(),
    summary: input.summary,
    daily: input.daily,
    entities: input.entities,
    entity_level: input.level,
    config_error: null,
    shared_account: shared,
    note: shared
      ? 'This ad account is mapped to more than one location. Figures are the full account and are not split.'
      : null,
  };
}
