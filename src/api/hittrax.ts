/**
 * HitTrax API helpers — v1.3 flow.
 *
 * Thin wrappers around the HitTrax-related Edge Functions:
 *   - hittrax-associate   POST (three modes — see below)
 *   - hittrax-disconnect  POST { kid_id }
 *
 * Association modes:
 *   Mode 1 – password:    { kid_id, hittrax_username, hittrax_password }
 *   Mode 2 – OTP trigger: { kid_id, hittrax_username, use_otp: true }
 *     → HitTrax texts a code to the user's registered phone.
 *     → Returns { status: 'otp_sent' }. No DB write yet.
 *   Mode 3 – OTP submit:  { kid_id, hittrax_username, otp_code: string }
 *     → Completes association using the SMS code.
 *
 * Modes 1 & 3 return { link_id, association_status: 'active', hittrax_username }.
 * The link goes directly to 'active' — no email confirmation / pending state.
 *
 * getHitTraxLinkForKid excludes `third_party_user_password` so a leaked
 * client log never spills the HitTrax-issued credential.
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

/** Returned by Mode 2 (OTP trigger). No DB write — SMS was sent. */
export type OTPTriggerResponse = {
  status: 'otp_sent';
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
 * Mode 1: Associate using HitTrax username + password.
 * The password is used once server-side to authenticate; it is never stored.
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

/**
 * Mode 2: Trigger OTP — HitTrax sends an SMS code to the user's registered phone.
 * No association happens yet. Call associateHitTraxWithOTP() after the user
 * enters the code they receive.
 */
export async function triggerHitTraxOTP(
  kidId: string,
  hittraxUsername: string,
): Promise<OTPTriggerResponse> {
  const { data, error } = await supabase.functions.invoke('hittrax-associate', {
    body: { kid_id: kidId, hittrax_username: hittraxUsername, use_otp: true },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return data as OTPTriggerResponse;
}

/**
 * Mode 3: Complete association using the SMS code the user received.
 * The code is submitted to HitTrax to get a session token, then the account
 * is associated and the link goes straight to 'active'.
 */
export async function associateHitTraxWithOTP(
  kidId: string,
  hittraxUsername: string,
  otpCode: string,
): Promise<AssociateResponse> {
  const { data, error } = await supabase.functions.invoke('hittrax-associate', {
    body: { kid_id: kidId, hittrax_username: hittraxUsername, otp_code: otpCode },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return data as AssociateResponse;
}

// ---------------------------------------------------------------------------
// Create HitTrax account in-app
// ---------------------------------------------------------------------------

export type CreateHitTraxAccountInput = {
  kidId: string;
  hittraxUsername: string;
  password: string;
  sport: 'Baseball' | 'Fastpitch Softball' | 'Slowpitch Softball';
  skillLevel: string;
  gender: 'male' | 'female' | 'other';
  position?: string;
  bats?: 'Right' | 'Left' | 'Switch';
  throws?: 'Right' | 'Left';
  heightInches?: number;
};

/**
 * Create a new HitTrax Cloud account for the kid. The account is
 * pre-linked to Ballpark — the link goes straight to 'active' with no
 * extra association step.
 */
export async function createHitTraxAccount(
  input: CreateHitTraxAccountInput,
): Promise<AssociateResponse> {
  const { kidId, hittraxUsername, password, sport, skillLevel, gender, position, bats, throws: throws_, heightInches } = input;
  const { data, error } = await supabase.functions.invoke('hittrax-create-account', {
    body: {
      kid_id: kidId,
      hittrax_username: hittraxUsername,
      password,
      sport,
      skill_level: skillLevel,
      gender,
      ...(position ? { position } : {}),
      ...(bats ? { bats } : {}),
      ...(throws_ ? { throws: throws_ } : {}),
      ...(heightInches !== undefined ? { height_inches: heightInches } : {}),
    },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return data as AssociateResponse;
}

/**
 * Check whether a HitTrax username is available.
 * Returns true if the username can be registered, false if already taken.
 */
export async function checkHitTraxUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('hittrax-create-account', {
    body: { check_username: username },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return (data as { available: boolean }).available;
}

// ---------------------------------------------------------------------------
// Kiosk QR scan
// ---------------------------------------------------------------------------

export type KioskEventResponse = {
  ok: true;
  event_type: string;
  kiosk_response: string;
};

/**
 * Fire a HitTrax kiosk event for the kid by scanning the kiosk QR code.
 * The QR code URL is validated server-side against the configured HitTrax
 * server origin before credentials are appended.
 */
export async function notifyKioskEvent(
  kidId: string,
  qrUrl: string,
): Promise<KioskEventResponse> {
  const { data, error } = await supabase.functions.invoke('hittrax-kiosk-event', {
    body: { kid_id: kidId, qr_url: qrUrl },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return data as KioskEventResponse;
}

/** Disconnect a kid's HitTrax link (remove association + flip status). */
export async function disconnectHitTrax(kidId: string): Promise<{ link_id: string }> {
  const { data, error } = await supabase.functions.invoke('hittrax-disconnect', {
    body: { kid_id: kidId },
  });
  if (error) throw new Error(await extractFunctionError(error));
  return data as { link_id: string };
}
