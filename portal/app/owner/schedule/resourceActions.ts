'use server';

import { requireSchedulingLocation } from '@/lib/scheduling';

export async function fetchSchedulingResources(locationId: string) {
  const { client, tenantId } = await requireSchedulingLocation(locationId, true);
  const [resources, history] = await Promise.all([
    client.from('scheduling_resources').select('id, cage_number, purpose, is_active')
      .eq('tenant_id', tenantId).eq('location_id', locationId).order('cage_number'),
    client.from('scheduling_resource_history').select('id, resource_id, previous_purpose, purpose, previous_active, is_active, changed_at, actor_id, reason')
      .eq('tenant_id', tenantId).eq('location_id', locationId).order('changed_at', { ascending: false }).limit(20),
  ]);
  if (resources.error || history.error) throw new Error('Resources could not be loaded.');
  return { resources: resources.data ?? [], history: history.data ?? [] };
}

export async function saveSchedulingResource(input: {
  locationId: string; cage: string; purpose: string; active: boolean; reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { client, role } = await requireSchedulingLocation(input.locationId);
    if (!['owner', 'super_admin'].includes(role)) return { ok: false, error: 'Only tenant owners can configure resources.' };
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,39}$/.test(input.cage.trim()) || !['instruction', 'rental', 'both'].includes(input.purpose)
      || typeof input.active !== 'boolean' || !input.reason.trim() || input.reason.length > 2000) {
      return { ok: false, error: 'Enter a cage identifier, purpose and reason (up to 2,000 characters).' };
    }
    const { error } = await client.rpc('set_scheduling_resource', {
      p_location_id: input.locationId, p_cage_number: input.cage.trim(), p_purpose: input.purpose,
      p_active: input.active, p_reason: input.reason.trim(),
    });
    if (error?.message.includes('resource_has_future_reservations')) return { ok: false, error: 'This resource is used by future bookings or camp dates. Reassign those before changing its purpose or retiring it.' };
    if (error) return { ok: false, error: 'The resource could not be saved.' };
    return { ok: true };
  } catch { return { ok: false, error: 'Not authorized, or the resource could not be saved.' }; }
}
