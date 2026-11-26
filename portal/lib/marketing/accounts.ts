/**
 * Location → ad account binding for Phase 1.
 * META_AD_ACCOUNT_MAP is JSON { "<location uuid>": "act_…" }. No table and no writes.
 * Owners with personal staff_locations rows are limited to those locations.
 * Owners with none are tenant-wide, which matches locations_owner_select.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationConnection } from './types';

const LOCATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdAccountMap {
  map: Record<string, string>;
  error: string | null;
}

export interface AuthorizedLocation {
  id: string;
  name: string;
  timezone: string | null;
}

export function reportingMode(preview: boolean): 'sample' | 'live' {
  if (preview) return 'sample';
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (typeof token !== 'string' || token.trim() === '') return 'sample';
  return 'live';
}

export function normalizeAdAccountId(value: string): string | null {
  const trimmed = value.trim();
  const withPrefix = trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
  return /^act_\d+$/.test(withPrefix) ? withPrefix : null;
}

export function parseAdAccountMap(raw: string | undefined): AdAccountMap {
  if (!raw || !raw.trim()) return { map: {}, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { map: {}, error: 'META_AD_ACCOUNT_MAP is not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { map: {}, error: 'META_AD_ACCOUNT_MAP must be a JSON object of location id to ad account id' };
  }
  const map: Record<string, string> = {};
  for (const [locationId, value] of Object.entries(parsed)) {
    if (!LOCATION_ID.test(locationId) || typeof value !== 'string') continue;
    const accountId = normalizeAdAccountId(value);
    if (accountId) map[locationId.toLowerCase()] = accountId;
  }
  return { map, error: null };
}

export function accountForLocation(locationId: string, map: Record<string, string>): string | null {
  return map[locationId.toLowerCase()] ?? null;
}

export function connectionForAccount(accountId: string | null): Exclude<LocationConnection, 'sample'> {
  return accountId ? 'connected' : 'not_connected';
}

export function accountIsShared(accountId: string | null, map: Record<string, string>): boolean {
  if (!accountId) return false;
  return Object.values(map).filter((value) => value === accountId).length > 1;
}

export async function listAuthorizedLocations(
  client: SupabaseClient,
  userId: string,
  tenantId: string,
): Promise<AuthorizedLocation[]> {
  const grants = await client.from('staff_locations').select('location_id').eq('user_id', userId);
  if (grants.error) throw new Error('Could not verify staff location grants');
  const ids = (grants.data ?? [])
    .map((row) => (row as { location_id?: string }).location_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const base = client.from('locations').select('id, name, timezone').eq('tenant_id', tenantId);
  const result = ids.length > 0
    ? await base.in('id', ids).order('name')
    : await base.order('name');
  if (result.error) throw new Error('Could not load authorized locations');

  return (result.data ?? []).map((row) => {
    const record = row as { id?: string; name?: string | null; timezone?: string | null };
    return {
      id: String(record.id ?? ''),
      name: record.name?.trim() ? record.name : 'Location',
      timezone: record.timezone ?? null,
    };
  }).filter((location) => location.id.length > 0);
}
