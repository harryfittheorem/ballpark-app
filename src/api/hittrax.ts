/**
 * HitTrax API helpers (task #118).
 *
 * Thin wrappers around the four HitTrax-related Edge Functions:
 *   - hittrax-associate          POST { kid_id, hittrax_user_id }
 *   - hittrax-disconnect         POST { kid_id }
 *   - (registration-complete + forget are inbound — never called from client)
 *
 * Plus a SELECT helper that scopes by kid_id and returns ONLY the columns
 * the UI is allowed to render — explicitly excluding
 * `third_party_user_password` so a leaked client log never spills the
 * HitTrax-issued credential. (RLS narrows rows; column projection narrows
 * fields. PostgREST has no per-column RLS, so this lives in the API layer.)
 */

import { supabase } from '@/lib/supabase';

import type { Database } from '@/types/database';

// Narrow the generated Row to the columns we actually project + the union
// types we know are enforced by the table-level CHECK constraints. Picking
// from the typed Row keeps us in sync with future schema changes — adding a
// new column won't widen this type until we add it to SAFE_COLUMNS too.
type KidCaptureLinkRow = Database['public']['Tables']['kid_capture_links']['Row'];
export type KidCaptureLink = Omit<
  Pick<
    KidCaptureLinkRow,
    | 'id'
    | 'kid_id'
    | 'external_user_id'
    | 'hittrax_registration_status'
    | 'hittrax_release_status'
    | 'associated_at'
    | 'removed_at'
    | 'last_polled_through'
    | 'last_polled_at'
    | 'last_poll_error'
    | 'created_at'
    | 'updated_at'
  >,
  never
> & {
  capture_source: 'hittrax' | 'rapsodo';
  association_status: 'pending' | 'active' | 'declined' | 'removed';
};

const SAFE_COLUMNS =
  'id, kid_id, capture_source, external_user_id, hittrax_registration_status, hittrax_release_status, association_status, associated_at, removed_at, last_polled_through, last_polled_at, last_poll_error, created_at, updated_at';

/** Read the HitTrax link (if any) for a single kid. Excludes the password. */
export async function getHitTraxLinkForKid(
  kidId: string,
): Promise<KidCaptureLink | null> {
  const { data, error } = await supabase
    .from('kid_capture_links')
    .select(SAFE_COLUMNS)
    .eq('kid_id', kidId)
    .eq('capture_source', 'hittrax')
    .maybeSingle();
  if (error) throw error;
  // The PostgREST projection narrows the row at runtime; the union narrowing
  // on capture_source/association_status is enforced by the table CHECK
  // constraints (see migration 20260508060000) so this cast is sound.
  return (data as KidCaptureLink | null) ?? null;
}

export type AssociateResponse = {
  link_id: string;
  association_status: 'pending';
  hittrax_registration_status: boolean;
  hittrax_release_status: boolean;
};

/** Kick off the AssociateThirdPartyAccount flow for a kid. */
export async function associateHitTrax(
  kidId: string,
  hittraxUserId: string,
): Promise<AssociateResponse> {
  const { data, error } = await supabase.functions.invoke('hittrax-associate', {
    body: { kid_id: kidId, hittrax_user_id: hittraxUserId },
  });
  if (error) {
    // Edge Function errors come back as FunctionsError — surface the
    // server-side error code/message when present.
    const message =
      (error as unknown as { context?: { error?: { message?: string } } })?.context
        ?.error?.message ?? error.message;
    throw new Error(message);
  }
  return data as AssociateResponse;
}

/** Disconnect a kid's HitTrax link (RemoveThirdPartyAssociation + flip status). */
export async function disconnectHitTrax(kidId: string): Promise<{ link_id: string }> {
  const { data, error } = await supabase.functions.invoke('hittrax-disconnect', {
    body: { kid_id: kidId },
  });
  if (error) {
    const message =
      (error as unknown as { context?: { error?: { message?: string } } })?.context
        ?.error?.message ?? error.message;
    throw new Error(message);
  }
  return data as { link_id: string };
}
