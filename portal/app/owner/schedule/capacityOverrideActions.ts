'use server';

import { requireSchedulingLocation, schedulingActor } from '@/lib/scheduling';

export async function fetchCapacityOverrides(locationId: string) {
  const { client, tenantId } = await requireSchedulingLocation(locationId, true);
  const [overrides, history] = await Promise.all([
    client.from('scheduling_capacity_overrides')
      .select('id, location_id, category, starts_at, ends_at, capacity, reason')
      .eq('tenant_id', tenantId).eq('location_id', locationId).eq('is_active', true)
      .gt('ends_at', new Date().toISOString()).order('starts_at').limit(100),
    client.from('scheduling_override_history')
      .select('id, category, starts_at, ends_at, previous_capacity, new_capacity, actor_id, changed_at, reason')
      .eq('tenant_id', tenantId).eq('location_id', locationId)
      .order('changed_at', { ascending: false }).limit(20),
  ]);
  if (overrides.error || history.error) throw new Error('Capacity windows could not be loaded.');
  return { overrides: overrides.data ?? [], history: history.data ?? [] };
}

type SaveInput = {
  locationId: string; category: 'lesson' | 'rental';
  start: string; end: string; capacity: number; reason: string;
};
type SaveResult = { ok: true } | { ok: false; error: string };

function errorMessage(message: string) {
  if (message.includes('capacity_below_existing_reservations')) return 'This change would put existing bookings over capacity. No limits or bookings were changed.';
  if (message.includes('overlapping_capacity_override')) return 'Another override overlaps this category and time window. Edit that window instead; overrides cannot be stacked.';
  if (message.includes('capacity_policy_required')) return 'An owner must configure the normal manual capacity for this location first.';
  if (message.includes('PERMISSION_DENIED')) return 'Only owners and admins assigned to this location can change dated capacity.';
  return 'The capacity change was not saved.';
}

export async function saveCapacityOverride(input: SaveInput): Promise<SaveResult> {
  try {
    const { client } = await requireSchedulingLocation(input.locationId);
    const start = Date.parse(input.start), end = Date.parse(input.end);
    if (!['lesson', 'rental'].includes(input.category) || !Number.isFinite(start) || !Number.isFinite(end)
      || end <= start || end <= Date.now() || !Number.isSafeInteger(input.capacity)
      || input.capacity <= 0 || input.capacity > 2147483647 || !input.reason.trim() || input.reason.length > 2000) {
      return { ok: false, error: 'Enter a valid window, a positive whole-number capacity and a reason of up to 2,000 characters.' };
    }
    const { error } = await client.rpc('set_booking_capacity_override', {
      p_location_id: input.locationId, p_category: input.category,
      p_start: new Date(start).toISOString(), p_end: new Date(end).toISOString(),
      p_capacity: input.capacity, p_reason: input.reason.trim(),
    });
    return error ? { ok: false, error: errorMessage(error.message) } : { ok: true };
  } catch { return { ok: false, error: 'Not authorized, or the capacity change could not be saved.' }; }
}

export async function removeCapacityOverride(id: string, reason: string): Promise<SaveResult> {
  try {
    const { client } = await schedulingActor();
    if (!reason.trim() || reason.length > 2000) return { ok: false, error: 'Enter a removal reason of up to 2,000 characters.' };
    const { error } = await client.rpc('remove_booking_capacity_override', {
      p_override_id: id, p_reason: reason.trim(),
    });
    return error ? { ok: false, error: errorMessage(error.message) } : { ok: true };
  } catch { return { ok: false, error: 'Not authorized, or the override could not be removed.' }; }
}
