// =============================================================================
// supabase/functions/mux-create-upload/index.ts
// =============================================================================
// v0.4 Step 4.4 — Mux Direct Upload URL minter.
//
// Contract (POST):
//   Headers:
//     Authorization: Bearer <coach-jwt>     required
//     Idempotency-Key: <client-uuid>        optional but recommended
//   Body (optional JSON):
//     { purpose?: 'coach_message' | 'drill' }   defaults to 'coach_message'
//   Response 200: { upload_url: string, video_id: string }
//   Errors:     { error: { code: string, message: string } }
//                 401 unauthorized | 403 forbidden | 405 method_not_allowed
//                 502 mux_error | mux_unreachable | mux_bad_response
//                 504 mux_timeout | 500 db_error | 409 conflict
//
// Auth model:
//   1. Header is parsed; missing/malformed -> 401.
//   2. JWT signature is verified by calling supabase.auth.getUser(token) on an
//      ANON-KEY client — never trust an unverified decode for auth decisions.
//   3. After verification we decode the payload only to read custom claims
//      (app_role, tenant_id) which the access-token hook injects (and which
//      are NOT in user.user_metadata).
//   4. app_role !== 'coach' -> 403.
//
// DB write model:
//   Insert uses SUPABASE_SERVICE_ROLE_KEY so the call doesn't depend on user
//   JWT RLS, but tenant_id and uploaded_by_user_id are pinned from the
//   verified JWT — the client can't smuggle either.
//
// Idempotency:
//   Forward client Idempotency-Key to Mux. Mux returns the SAME upload row
//   (same `id`) for repeated calls with the same key. We store that upload id
//   in videos.mux_asset_id (UNIQUE), so a retry hits the existing row and we
//   return its video_id without a second insert. The webhook in Step 4.5 will
//   later replace this with the real asset_id once Mux finishes processing.
//
// Failure model:
//   Mux is called BEFORE the DB insert, so any Mux 5xx / timeout / malformed
//   response leaves no orphan row in public.videos.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID")!;
const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET")!;

const MUX_TIMEOUT_MS = 10_000;
const MUX_UPLOADS_URL = "https://api.mux.com/video/v1/uploads";

type ErrorCode =
  | "method_not_allowed"
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "mux_error"
  | "mux_unreachable"
  | "mux_bad_response"
  | "mux_timeout"
  | "db_error"
  | "conflict";

function jsonError(status: number, code: ErrorCode, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Decode (without verifying) the payload of a JWT we have ALREADY verified
// via supabase.auth.getUser. Used only to read custom claims that the
// access-token hook injects (app_role, tenant_id) and which are not surfaced
// on the user object.
function decodeVerifiedJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed", "POST required");
  }

  // ---- 1. Parse Authorization header --------------------------------------
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonError(401, "unauthorized", "Empty bearer token");
  }

  // ---- 2. Verify the JWT against the project (anon-key client) ------------
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonError(401, "unauthorized", "Invalid or expired token");
  }
  const userId = userData.user.id;

  // ---- 3. Read custom claims from the verified JWT -----------------------
  const payload = decodeVerifiedJwtPayload(token);
  const appRole = typeof payload?.app_role === "string" ? (payload.app_role as string) : undefined;
  const tenantId = typeof payload?.tenant_id === "string" ? (payload.tenant_id as string) : undefined;

  if (!tenantId) {
    return jsonError(401, "unauthorized", "Token missing tenant_id claim");
  }
  if (appRole !== "coach") {
    return jsonError(403, "forbidden", "Coach role required");
  }

  // ---- 3b. Read optional purpose from request body ------------------------
  // Body is optional; tolerate missing / malformed JSON the same way as
  // before (treat as empty object). Anything other than the two known
  // purposes is rejected so the DB CHECK constraint never gets a chance
  // to surface as a 500.
  let bodyJson: { purpose?: unknown } = {};
  try {
    const raw = await req.text();
    if (raw) bodyJson = JSON.parse(raw) as { purpose?: unknown };
  } catch {
    bodyJson = {};
  }
  const purpose: "coach_message" | "drill" =
    bodyJson.purpose === "drill" ? "drill" : "coach_message";
  if (
    bodyJson.purpose !== undefined &&
    bodyJson.purpose !== "coach_message" &&
    bodyJson.purpose !== "drill"
  ) {
    return jsonError(400, "bad_request", "Invalid purpose");
  }

  // ---- 4. Call Mux Direct Upload API --------------------------------------
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");

  const muxBasicAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
  const muxHeaders: Record<string, string> = {
    Authorization: `Basic ${muxBasicAuth}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) muxHeaders["Idempotency-Key"] = idempotencyKey;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), MUX_TIMEOUT_MS);

  let muxRes: Response;
  try {
    muxRes = await fetch(MUX_UPLOADS_URL, {
      method: "POST",
      headers: muxHeaders,
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: { playback_policy: ["public"] },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if ((err as Error)?.name === "AbortError") {
      return jsonError(504, "mux_timeout", "Mux request timed out");
    }
    return jsonError(502, "mux_unreachable", "Failed to reach Mux");
  }
  clearTimeout(timeoutHandle);

  if (!muxRes.ok) {
    // Drain body to free the connection; do not leak Mux details.
    try { await muxRes.text(); } catch { /* ignore */ }
    return jsonError(502, "mux_error", `Mux returned status ${muxRes.status}`);
  }

  let muxJson: { data?: { id?: string; url?: string } } | null = null;
  try {
    muxJson = await muxRes.json();
  } catch {
    return jsonError(502, "mux_bad_response", "Malformed Mux response");
  }
  const uploadId = muxJson?.data?.id;
  const uploadUrl = muxJson?.data?.url;
  if (!uploadId || !uploadUrl) {
    return jsonError(502, "mux_bad_response", "Mux response missing id or url");
  }

  // ---- 5. Insert (or fetch on idempotent retry) the videos row -----------
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Look up first: an idempotent Mux retry returns the same upload id, and
  // mux_asset_id is UNIQUE — so the existing row IS the canonical answer.
  const { data: existing, error: existingErr } = await adminClient
    .from("videos")
    .select("id, uploaded_by_user_id, tenant_id")
    .eq("mux_asset_id", uploadId)
    .maybeSingle();

  if (existingErr) {
    return jsonError(500, "db_error", "Failed to query videos");
  }

  if (existing) {
    if (
      existing.uploaded_by_user_id !== userId ||
      existing.tenant_id !== tenantId
    ) {
      // Defensive: should be impossible because Mux would not hand the same
      // upload id to a different caller, but guard anyway.
      return jsonError(409, "conflict", "Idempotency key collides across users/tenants");
    }
    return jsonOk({ upload_url: uploadUrl, video_id: existing.id });
  }

  const { data: inserted, error: insertErr } = await adminClient
    .from("videos")
    .insert({
      tenant_id: tenantId,
      uploaded_by_user_id: userId,
      mux_asset_id: uploadId,
      status: "uploading",
      purpose,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    // Race-loser path: another concurrent request inserted the same upload id.
    // Re-fetch with ownership columns and apply the SAME tenant/user check as
    // the existing-row branch — never return a video_id owned by a different
    // caller, even in a race / shared-credential collision scenario.
    const { data: retryRow, error: retryErr } = await adminClient
      .from("videos")
      .select("id, uploaded_by_user_id, tenant_id")
      .eq("mux_asset_id", uploadId)
      .maybeSingle();
    if (retryErr) {
      return jsonError(500, "db_error", "Failed to insert video row");
    }
    if (retryRow) {
      if (
        retryRow.uploaded_by_user_id !== userId ||
        retryRow.tenant_id !== tenantId
      ) {
        return jsonError(409, "conflict", "Idempotency key collides across users/tenants");
      }
      return jsonOk({ upload_url: uploadUrl, video_id: retryRow.id });
    }
    return jsonError(500, "db_error", "Failed to insert video row");
  }

  return jsonOk({ upload_url: uploadUrl, video_id: inserted.id });
});
