import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';

/** Never use a service client or editable user_metadata for scheduling authority. */
export async function schedulingActor() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  const { data: { session } } = await client.auth.getSession();
  const role = readAppRole(session);
  const tenantId = readTenantId(session);
  if (error || !user || !tenantId || !['owner', 'admin', 'coach', 'super_admin'].includes(role)) {
    throw new Error('Not authorized. Sign in with a tenant-scoped staff account.');
  }
  return { client, tenantId, role, userId: user.id };
}

export async function requireSchedulingLocation(locationId: string, allowCoach = false) {
  const actor = await schedulingActor();
  if (!allowCoach && actor.role === 'coach') throw new Error('Not authorized to schedule.');
  const { data, error } = await actor.client.rpc('can_manage_booking_location', {
    p_tenant_id: actor.tenantId, p_location_id: locationId,
  });
  if (error || data !== true) throw new Error('Location not authorized.');
  return actor;
}
