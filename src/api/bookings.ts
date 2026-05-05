/**
 * Bookings API helpers.
 *
 * Thin Supabase select wrappers used by the Book tab. Tenant scoping is
 * enforced by RLS (see `session_types_select_tenant` in
 * `20260505050000_v03_bookings_schema.sql`), so we don't need to filter by
 * tenant_id client-side — the policy will only return rows the caller can see.
 */

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type SessionType = Tables<'session_types'>;
export type CoachAvailability = Tables<'coach_availability'>;
export type Location = Tables<'locations'>;

export async function listSessionTypes(): Promise<SessionType[]> {
  const { data, error } = await supabase
    .from('session_types')
    .select('*')
    .eq('is_active', true)
    .order('type_category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all coach_availability rows the caller can see (RLS scopes by tenant).
 * Returns recurring weekly windows; one row per coach + day_of_week.
 */
export async function listCoachAvailability(): Promise<CoachAvailability[]> {
  const { data, error } = await supabase
    .from('coach_availability')
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function getLocationById(id: string): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
