/**
 * tenantConfig API — fetch per-tenant feature flags.
 *
 * tenant_config is a Phase 2 table not yet in the generated database.ts types.
 * The Supabase client is cast to the un-typed SupabaseClient (not any) so all
 * other methods retain full type safety. Source of truth: migrations
 * 20260601000001_phase2_tenant_config.sql and
 * 20260602000001_cancellation_policy.sql.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

const sb: SupabaseClient = supabase as unknown as SupabaseClient;

export type TenantConfig = {
  id: string;
  tenant_id: string;
  booking_cancel_window_hours: number;
  booking_cancel_fee_cents: number;
  membership_cancel_notice_days: number;
};

/**
 * Fetch the tenant_config row for the calling user's tenant.
 * Returns null if no config row exists (treat all flags as default values).
 */
export async function getTenantConfig(): Promise<TenantConfig | null> {
  const { data, error } = await sb
    .from('tenant_config')
    .select(
      'id, tenant_id, booking_cancel_window_hours, booking_cancel_fee_cents, membership_cancel_notice_days',
    )
    .maybeSingle();

  if (error) throw error;
  return data as TenantConfig | null;
}
