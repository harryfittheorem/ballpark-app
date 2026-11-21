import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { assertUUID, fixtureLocation, fixtureTenant, literal, localSQL, previewReady } from './local';
import type { CRMContext } from './http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './local';

async function approvedPreviewScope(): Promise<{ location_id: string; operator_id: string } | null> {
  let text: string;
  try { text = await readFile(path.join(root, 'generated-artifacts/crm-pilot/approved-scope.json'), 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error('Approved rehearsal scope could not be read');
  }
  try {
    const value = JSON.parse(text);
    return { location_id: assertUUID(value.location_id), operator_id: assertUUID(value.operator_id) };
  } catch { throw new Error('Approved rehearsal scope is invalid'); }
}

/** Cookie identity only. No service role can act as the caller. */
export async function crmContext(request: Request): Promise<CRMContext> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  const { data: { session } } = await client.auth.getSession();
  const role = readAppRole(session), tenantId = readTenantId(session);
  if (error || !user || !tenantId || !['owner', 'admin'].includes(role)) throw new Error('Staff sign-in required');
  const preview = new URL(request.url).searchParams.get('preview') === '1';
  if (preview) {
    if (!previewReady()) throw new Error('Isolated rehearsal not initialized');
    // Existing operational identities only. Fixture grants do not grant
    // anything in Supabase, and the second location is deliberately excluded.
    const scope = await approvedPreviewScope();
    if (scope && scope.operator_id !== user.id) throw new Error('Designated rehearsal operator required');
    const { data: locations, error: locationError } = await client.from('locations').select('id,name,timezone').eq('tenant_id', tenantId);
    if (locationError || !locations?.length) throw new Error('No authorized staff location');
    const candidates = scope ? locations.filter(location => location.id === scope.location_id) : locations;
    if (!candidates.length) throw new Error('Approved rehearsal location not authorized');
    const { data: grants, error: grantError } = await client.from('staff_locations').select('location_id')
      .eq('user_id', user.id).in('location_id', candidates.map(location => location.id)).limit(1);
    if (grantError || !grants?.length) throw new Error('Explicit staff location required');
    const id = assertUUID(user.id);
    // Mirror only the already-verified cookie role into the isolated tenant so
    // the unchanged JWT hook can validate its operator there too. This never
    // creates or changes a real account, role or location grant in Supabase.
    await localSQL(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES('${id}',
      jsonb_build_object('app_role',${literal(role)}#>>'{}','tenant_slug',
        (SELECT slug FROM tenants WHERE id='${fixtureTenant}')))
      ON CONFLICT(id) DO UPDATE SET raw_user_meta_data=EXCLUDED.raw_user_meta_data;
      INSERT INTO staff_locations(user_id,location_id) SELECT '${id}','${fixtureLocation}' WHERE NOT EXISTS(
      SELECT 1 FROM staff_locations WHERE user_id='${id}' AND location_id='${fixtureLocation}'); SELECT true;`);
    if (scope) {
      const source = candidates[0];
      await localSQL(`UPDATE locations SET name=${literal(`${source.name} • Isolated staff pilot`)}#>>'{}',
        timezone=${literal(source.timezone)}#>>'{}' WHERE id='${fixtureLocation}';
        UPDATE crm_locations SET timezone=${literal(source.timezone)}#>>'{}' WHERE location_id='${fixtureLocation}'; SELECT true;`);
    }
    // Keep the verified existing actor/role, but map the development-only
    // database scope to its synthetic tenant. Never reuse this for live RPCs.
    return { preview, userId: id, role, tenantId: fixtureTenant, locations: [{ id: fixtureLocation,
      name: scope ? `${candidates[0].name} • Isolated staff pilot` : 'Clearwater • Rehearsal' }] };
  }
  const { data: grants, error: grantsError } = await client.from('staff_locations').select('location_id').eq('user_id', user.id);
  if (grantsError) throw new Error('Could not verify staff location grants');
  const ids = (grants || []).map(g => g.location_id);
  const { data: locations, error: locationError } = await client.from('locations').select('id,name').eq('tenant_id', tenantId).in('id', ids);
  if (locationError) throw new Error('Could not load authorized locations');
  return { preview, userId: user.id, role, tenantId, client, locations: locations || [] };
}
