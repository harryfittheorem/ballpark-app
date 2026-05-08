/**
 * Parent account deletion — calls the `account-delete` Edge Function.
 *
 * The function authenticates with the parent's JWT (verify-jwt = true)
 * and performs the COPPA/GDPR-compliant cascade:
 *   1. Outbound HitTrax RemoveThirdPartyAssociation for every active
 *      kid_capture_link (best-effort — never blocks deletion).
 *   2. Hard-deletes kid_capture_links rows.
 *   3. Deletes the auth user (FK cascade does the rest).
 *
 * On success the local session is invalidated; callers should
 * `await signOut()` immediately to flip RootNavigator back to SignIn.
 */

import { supabase } from '@/lib/supabase';

export type DeleteAccountResponse = {
  ok: true;
  hittrax_links_purged: number;
  kids_purged: number;
};

export async function deleteAccount(): Promise<DeleteAccountResponse> {
  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>('account-delete', {
    method: 'POST',
    body: {},
  });
  if (error) throw error;
  if (!data?.ok) throw new Error('account-delete returned an unexpected response');
  return data;
}
