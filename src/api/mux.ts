/**
 * Mux API helpers (client side).
 *
 * `createMuxUpload` calls our `mux-create-upload` Edge Function (Step 4.4),
 * which mints a Mux Direct Upload URL and inserts the corresponding
 * `public.videos` row. The function authorizes the caller from the JWT and
 * pins `tenant_id` / `uploaded_by_user_id` server-side, so the client must
 * NOT send those fields — only an `Authorization: Bearer <jwt>` header and an
 * `Idempotency-Key` so a flaky retry returns the SAME upload row instead of
 * creating a duplicate.
 *
 * Errors from the function come back as `{ error: { code, message } }`; we
 * surface them through the same `errorMessage()` shape the rest of the app
 * uses, so `catch (err) { Alert.alert(..., errorMessage(err)); }` Just Works.
 */

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

if (!SUPABASE_URL) {
  // Mirrors src/lib/supabase.ts — fail loudly instead of silently calling
  // `undefined/functions/...`.
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set');
}

const FUNCTION_URL = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/mux-create-upload`;

export type MuxUpload = {
  upload_url: string;
  video_id: string;
};

type MuxFunctionErrorBody = {
  error?: { code?: string; message?: string };
};

/**
 * Thrown when the Edge Function returns a structured error. Carries the
 * server `code` so callers can branch (e.g. show a special message on
 * `forbidden`) and `errorMessage()` formats it as `"<msg> [<code>]"` to
 * match how `bookings.ts` surfaces PostgrestError shapes.
 */
export class MuxFunctionError extends Error {
  code: string;
  status: number;
  details?: string;
  constructor(opts: { code: string; message: string; status: number; details?: string }) {
    super(opts.message);
    this.name = 'MuxFunctionError';
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }
}

/**
 * Mint a fresh Mux Direct Upload. Returns `{ upload_url, video_id }` on
 * success. Pass the SAME `idempotencyKey` for any retries of the same
 * user-initiated attempt so we don't create duplicate `videos` rows; only
 * generate a new key when the coach picks a different video.
 */
export type MuxUploadPurpose = 'coach_message' | 'drill';

export async function createMuxUpload(
  idempotencyKey: string,
  purpose: MuxUploadPurpose = 'coach_message',
): Promise<MuxUpload> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new MuxFunctionError({
      code: 'no_session',
      message: 'You are signed out. Sign back in and try again.',
      status: 401,
    });
  }

  let res: Response;
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ purpose }),
    });
  } catch (err) {
    throw new MuxFunctionError({
      code: 'network_error',
      message: 'Could not reach the upload service. Check your connection and try again.',
      status: 0,
      details: err instanceof Error ? err.message : undefined,
    });
  }

  // Try to parse the JSON body whether the call succeeded or failed; the
  // function returns JSON in both cases.
  let body: (MuxUpload & MuxFunctionErrorBody) | null = null;
  try {
    body = (await res.json()) as MuxUpload & MuxFunctionErrorBody;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const code = body?.error?.code ?? 'function_error';
    const message =
      body?.error?.message ?? `Upload service returned status ${res.status}`;
    throw new MuxFunctionError({ code, message, status: res.status });
  }

  if (!body?.upload_url || !body?.video_id) {
    throw new MuxFunctionError({
      code: 'bad_response',
      message: 'Upload service returned an unexpected response.',
      status: res.status,
    });
  }

  return { upload_url: body.upload_url, video_id: body.video_id };
}
