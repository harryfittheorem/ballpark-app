import type { SupabaseClient } from '@supabase/supabase-js';
import type { RetentionDataset, RetentionPolicy } from './types';

/** Always use explicit scope, including when the caller supplies a service client. */
export async function getRetentionDataset(
  client: SupabaseClient,
  scope: { kind: 'owner'; tenantId: string } | { kind: 'network' },
): Promise<RetentionDataset> {
  const asOf = new Date().toISOString();
  const result: RetentionDataset = {
    scope: scope.kind, locations: [], memberships: [], segments: [], coverage: [], policies: [],
    names: {}, issues: [], asOf,
    finance: { available: false, reason: 'LTV unavailable — the approved R02 finance contract is not available. No independent estimate is calculated.' },
    instructors: { available: false, reason: 'Instructor dimension unavailable — the R06 actual-instructor retention evidence contract is not available. No instructor impact is inferred.' },
  };
  if (scope.kind === 'owner' && !scope.tenantId) {
    result.issues.push('Authorized tenant scope unavailable.');
    return result;
  }
  if (scope.kind === 'network') {
    // This must be a cookie client. A service client has no authenticated user.
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) throw new Error('Network retention requires verified network access.');
    const verified = await client.from('super_admins').select('id').eq('user_id', user.id).maybeSingle();
    if (verified.error || !verified.data) throw new Error('Network retention requires verified network access.');
  }
  async function rows(table: string, columns = '*'): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = table === 'retention_coverage'
        ? client.from(table).select(columns).order('tenant_id').range(offset, offset + 999)
        : client.from(table).select(columns).order('recorded_at').order('id')
          .range(offset, offset + 999).lte('recorded_at', asOf);
      if (scope.kind === 'owner') query = query.eq('tenant_id', scope.tenantId);
      const response = await query;
      if (response.error) throw new Error(`${table}: historical evidence unavailable`);
      const page = (response.data ?? []) as unknown as Record<string, unknown>[];
      all.push(...page);
      if (page.length < 1000) return all;
    }
  }
  try {
    const [locations, memberships, segments, coverage, policies] = await Promise.all([
      rows('retention_reporting_locations', 'id,tenant_id,name,timezone,recorded_at'),
      rows('retention_membership_history', 'id,tenant_id,membership_id,kid_id,effective_at,recorded_at,source,state'),
      rows('retention_segment_history', 'id,tenant_id,kid_id,location_id,effective_at,recorded_at,source,state'),
      rows('retention_coverage', 'tenant_id,started_at'),
      rows('retention_policies', 'id,tenant_id,policy,recorded_at'),
    ]);
    result.locations = locations as unknown as RetentionDataset['locations'];
    result.memberships = memberships as unknown as RetentionDataset['memberships'];
    result.segments = segments as unknown as RetentionDataset['segments'];
    result.coverage = coverage as unknown as RetentionDataset['coverage'];
    result.policies = policies as unknown as Array<{ tenant_id: string; policy: RetentionPolicy }>;
    if (scope.kind === 'owner') {
      // Names are live identity labels only, never classification or cohort inputs.
      for (let offset = 0; ; offset += 1000) {
        const names = await client.from('kids').select('id,first_name,last_name,families!inner(tenant_id)')
          .eq('families.tenant_id', scope.tenantId).order('id').range(offset, offset + 999);
        if (names.error) { result.issues.push('Player names unavailable.'); break; }
        for (const kid of names.data ?? []) {
          result.names[`${scope.tenantId}:${kid.id}`] = [kid.first_name, kid.last_name].filter(Boolean).join(' ');
        }
        if ((names.data ?? []).length < 1000) break;
      }
    }
  } catch {
    // A missing migration or denied query must not look like zero members / 100%.
    result.issues.push('Historical retention evidence could not be loaded. Apply the retention evidence migration or retry; no snapshot or demo values are substituted.');
  }
  return result;
}
