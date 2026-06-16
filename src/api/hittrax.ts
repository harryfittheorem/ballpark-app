/**
 * HitTrax API helpers — v1.3 flow.
 *
 * Thin wrappers around the HitTrax-related Edge Functions:
 *   - hittrax-associate   POST { kid_id, hittrax_username, hittrax_password }
 *   - hittrax-disconnect  POST { kid_id }
 *   (registration-complete + forget are inbound — never called from client)
 *
 * v1.3 change: association is now instant and synchronous. The link goes
 * directly to 'active' — no email confirmation / pending state needed for
 * new connections. Existing v1.x users with 'pending' rows are supported via
 * the "Cancel and start over" disconnect path.
 *
 * getHitTraxLinkForKid excludes `third_party_user_password` so a leaked
 * client log never spills the HitTrax-issued credential. Column projection
 * + RLS work together: RLS narrows rows, this projection narrows fields.
 */

import { supabase } from '@/lib/supabase';

import type { Database } from '@/types/database';

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
  return (data as KidCaptureLink | null) ?? null;
}

/** v1.3: association is immediate — link goes straight to 'active'. */
export type AssociateResponse = {
  link_id: string;
  association_status: 'active';
  hittrax_username: string;
};

/**
 * Extract a human-readable message from a Supabase FunctionsError.
 * `FunctionsHttpError.context` is the raw Response — read its JSON body to
 * surface the server-side error message. Falls back to the SDK message.
 */
async function extractFunctionError(error: unknown): Promise<string> {
  try {
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const body = await ctx.json().catch(() => null);
      const serverMessage = body?.error?.message;
      if (typeof serverMessage === 'string' && serverMessage.length > 0) {
        return serverMessage;
      }
    }
  } catch {
    // ignore — fall through to error.message
  }
  return (error as { message?: string }).message ?? 'An unexpected error occurred.';
}

/**
 * Associate a kid with a HitTrax account using the parent's HitTrax
 * username + password. v1.3 flow: authenticate → associate → active.
 * The link is activated immediately — no email confirmation required.
 */
export async function associateHitTrax(
  kidId: string,
  hittraxUsername: string,
  hittraxPassword: string,
): Promise<AssociateResponse> {
  const { data, error } = await supabase.functions.invoke('hittrax-associate', {
    body: { kid_id: kidId, hittrax_username: hittraxUsername, hittrax_password: hittraxPassword },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return data as AssociateResponse;
}

/** Disconnect a kid's HitTrax link (remove association + flip status). */
export async function disconnectHitTrax(kidId: string): Promise<{ link_id: string }> {
  const { data, error } = await supabase.functions.invoke('hittrax-disconnect', {
    body: { kid_id: kidId },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return data as { link_id: string };
}
