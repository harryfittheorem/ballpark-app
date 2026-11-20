import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { assertUUID, fixtureLocation, fixtureTenant, localSQL, previewReady } from './local';
import type { CRMContext } from './http';

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
    const { data: locations, error: locationError } = await client.from('locations').select('id').eq('tenant_id', tenantId).limit(1);
    if (locationError || !locations?.length) throw new Error('No authorized staff location');
    if (role === 'admin') {
      const { data: grants } = await client.from('staff_locations').select('location_id').eq('user_id', user.id).limit(1);
      if (!grants?.length) throw new Error('Explicit staff location required');
    }
    const id = assertUUID(user.id);
    await localSQL(`INSERT INTO auth.users(id) VALUES('${id}') ON CONFLICT DO NOTHING;
      INSERT INTO staff_locations(user_id,location_id) SELECT '${id}','${fixtureLocation}' WHERE NOT EXISTS(
      SELECT 1 FROM staff_locations WHERE user_id='${id}' AND location_id='${fixtureLocation}'); SELECT true;`);
    // Keep the verified existing actor/role, but map the development-only
    // database scope to its synthetic tenant. Never reuse this for live RPCs.
    return { preview, userId: id, role, tenantId: fixtureTenant, locations: [{ id: fixtureLocation, name: 'Clearwater • Rehearsal' }] };
  }
  const { data: grants, error: grantsError } = await client.from('staff_locations').select('location_id').eq('user_id', user.id);
  if (grantsError) throw new Error('Could not verify staff location grants');
  const ids = (grants || []).map(g => g.location_id);
  const { data: locations, error: locationError } = await client.from('locations').select('id,name').eq('tenant_id', tenantId).in('id', ids);
  if (locationError) throw new Error('Could not load authorized locations');
  return { preview, userId: user.id, role, tenantId, client, locations: locations || [] };
}
