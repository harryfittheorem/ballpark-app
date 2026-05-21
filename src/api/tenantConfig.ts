/**
 * tenantConfig API — fetch per-tenant feature flags.
 *
 * tenant_config is a Phase 2 table not yet in the generated database.ts types.
 * The Supabase client is cast to the un-typed SupabaseClient (not any) so all
 * other methods retain full type safety. Source of truth: migration
 * 20260601000001_phase2_tenant_config.sql.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

const sb: SupabaseClient = supabase as unknown as SupabaseClient;

export type TenantConfig = {
  id: string;
  tenant_id: string;
  allow_cross_location_booking: boolean;
};

/**
 * Fetch the tenant_config row for the calling user's tenant.
 * Returns null if no config row exists (treat all flags as false).
 */
export async function getTenantConfig(): Promise<TenantConfig | null> {
  const { data, error } = await sb
    .from('tenant_config')
    .select('id, tenant_id, allow_cross_location_booking')
    .maybeSingle();

  if (error) throw error;
  return data as TenantConfig | null;
}
