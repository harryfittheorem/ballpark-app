import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';

export type ActiveWaiver = {
  id: string;
  version: number;
  body_text: string;
  effective_date: string;
};

export type FamilyWaiver = {
  id: string;
  waiver_id: string;
  signed_at: string;
  app_version: string | null;
};

/** Fetch the currently-active waiver for the authenticated user's tenant. */
export async function getActiveWaiver(): Promise<ActiveWaiver | null> {
  const { data, error } = await supabase
    .from('waivers')
    .select('id, version, body_text, effective_date')
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as ActiveWaiver | null;
}

/**
 * Check whether the authenticated family has signed the given waiver.
 * Returns the family_waivers record, or null if not yet signed.
 */
export async function getFamilyWaiver(waiverId: string): Promise<FamilyWaiver | null> {
  const { data, error } = await supabase
    .from('family_waivers')
    .select('id, waiver_id, signed_at, app_version')
    .eq('waiver_id', waiverId)
    .maybeSingle();

  if (error) throw error;
  return data as FamilyWaiver | null;
}

/**
 * Sign the given waiver on behalf of the authenticated family.
 * Idempotent — safe to call multiple times for the same (family, waiver) pair.
 */
export async function signWaiver(waiverId: string): Promise<void> {
  const appVersion =
    (Constants.expoConfig?.version ?? Constants.manifest?.version ?? undefined) as string | undefined;

  const { error } = await supabase.rpc('sign_waiver', {
    p_waiver_id: waiverId,
    p_app_version: appVersion,
  });

  if (error) throw error;
}
