import type { SupabaseClient } from '@supabase/supabase-js';

/** Owners retain their existing tenant-wide access, including all its locations.
 * Explicitly pin each relationship because service-role callers bypass RLS.
 */
export async function getScopedPlayer(client: SupabaseClient, tenantId: string, kidId: string) {
  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(kidId)) return null;
  const kidResult = await client.from('kids').select('id, family_id, first_name, last_name, families!inner(tenant_id)')
    .eq('families.tenant_id', tenantId).eq('id', kidId).maybeSingle();
  if (kidResult.error) throw new Error('Unable to load player. Please retry.');
  if (!kidResult.data) return null;
  const kid = kidResult.data;
  const familyResult = await client.from('families').select('id, primary_location_id')
    .eq('tenant_id', tenantId).eq('id', kid.family_id).maybeSingle();
  if (familyResult.error) throw new Error('Unable to verify player access. Please retry.');
  if (!familyResult.data) return null;
  const locationId = familyResult.data.primary_location_id;
  if (locationId) {
    const location = await client.from('locations').select('id')
      .eq('tenant_id', tenantId).eq('id', locationId).maybeSingle();
    if (location.error) throw new Error('Unable to verify location access. Please retry.');
    if (!location.data) return null;
  }
  const memberships = await client.from('memberships')
    .select('id, kid_id, family_id, plan_name, plan_type, status, started_at, sessions_total, sessions_remaining')
    .eq('tenant_id', tenantId).eq('kid_id', kidId).eq('family_id', kid.family_id)
    .order('started_at', { ascending: false }).order('id');
  if (memberships.error) throw new Error('Unable to load package history. Please retry.');
  return { kid, memberships: memberships.data ?? [] };
}
