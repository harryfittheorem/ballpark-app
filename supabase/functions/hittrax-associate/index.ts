// =============================================================================
// supabase/functions/hittrax-associate/index.ts
// =============================================================================
// HitTrax API v1.3 — associate a parent's kid with a HitTrax Cloud account.
//
// Contract (POST):
//   Headers:  Authorization: Bearer <parent-jwt>
//
//   Mode 1 – password auth:
//     Body:     { kid_id, hittrax_username, hittrax_password }
//     Response: { link_id, association_status: "active", hittrax_username }
//
//   Mode 2 – OTP trigger (no association yet, just sends SMS):
//     Body:     { kid_id, hittrax_username, use_otp: true }
//     Response: { status: "otp_sent" }
//
//   Mode 3 – OTP submit + associate:
//     Body:     { kid_id, hittrax_username, otp_code: "123456" }
//     Response: { link_id, association_status: "active", hittrax_username }
//
//   Errors:
//     401 unauthorized | 403 forbidden | 400 bad_request
//     404 hittrax_user_not_found | 400 hittrax_no_phone
//     409 conflict (kid already active) | 503 hittrax_not_configured
//     401 invalid_hittrax_credentials | 401 hittrax_invalid_otp
//     502 hittrax_error | 504 hittrax_timeout | 502 hittrax_unreachable
//
// v1.3 Association flow (Modes 1 & 3):
//   1. Authenticate → session token
//      Mode 1: AuthenticateCloudUser(username, password)
//      Mode 3: ProvideOTPResponseCode(username, otp_code)
//   2. AssociateThirdPartyAccountWithCloudCredentials(sessionToken, thirdPartyUserId)
//      → thirdPartyUserPassword
//   3. LogOutThirdPartyCloudUser(sessionToken)   [best-effort]
//   4. Upsert kid_capture_links: status = 'active', password stored.
//
// The link goes DIRECTLY to 'active' — no pending/email-confirmation step.
// The raw HitTrax password is never stored or logged.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import {
  associateThirdPartyAccount,
  authenticateCloudUser,
  hitTraxErrorResponse,
  jsonError,
  jsonOk,
  logOutSession,
  readHitTraxConfig,
  submitOTPCode,
  triggerOTP,
} from "../_shared/hittrax.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  const startedAt = Date.now();

  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "POST required");

  // ---- 1. Verify parent JWT -----------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return jsonError(401, "unauthorized", "Invalid or expired token");
  const userId = userData.user.id;

  const payload = decodeJwtPayload(token);
  const tenantId = typeof payload?.tenant_id === "string" ? payload.tenant_id : null;
  const appRole = typeof payload?.app_role === "string" ? payload.app_role : null;
  if (!tenantId) return jsonError(401, "unauthorized", "Token missing tenant_id claim");
  if (appRole !== "parent") return jsonError(403, "forbidden", "Parent role required");

  // ---- 2. Parse body and detect mode --------------------------------------
  let body: {
    kid_id?: unknown;
    hittrax_username?: unknown;
    hittrax_password?: unknown;
    use_otp?: unknown;
    otp_code?: unknown;
  };
  try { body = await req.json(); }
  catch { return jsonError(400, "bad_request", "Body is not valid JSON"); }

  const kidId = typeof body.kid_id === "string" ? body.kid_id : "";
  const hittraxUsername = typeof body.hittrax_username === "string" ? body.hittrax_username.trim() : "";
  const hittraxPassword = typeof body.hittrax_password === "string" ? body.hittrax_password : "";
  const useOtp = body.use_otp === true;
  const otpCode = typeof body.otp_code === "string" ? body.otp_code.trim() : "";

  if (!kidId) return jsonError(400, "bad_request", "kid_id required");
  if (!hittraxUsername) return jsonError(400, "bad_request", "hittrax_username required");
  if (!useOtp && !otpCode && !hittraxPassword) {
    return jsonError(400, "bad_request", "One of hittrax_password, use_otp, or otp_code is required");
  }

  // ---- 3. Verify kid ownership (all modes) --------------------------------
  const { data: kid, error: kidErr } = await adminClient
    .from("kids")
    .select("id, family_id, tenant_id:families!inner(tenant_id, parent_user_id)")
    .eq("id", kidId)
    .maybeSingle();
  if (kidErr) return jsonError(500, "db_error", "Failed to look up kid");
  if (!kid) return jsonError(403, "forbidden", "Kid not found or not yours");

  const family = kid.tenant_id as unknown as { tenant_id: string; parent_user_id: string } | null;
  if (!family || family.parent_user_id !== userId || family.tenant_id !== tenantId) {
    return jsonError(403, "forbidden", "Kid does not belong to this parent/tenant");
  }

  // ---- 4. HitTrax config (all modes) --------------------------------------
  const cfg = readHitTraxConfig();
  if (!cfg) return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned for this environment");

  // =========================================================================
  // MODE 2: OTP trigger — send SMS, return immediately (no DB write)
  // =========================================================================
  if (useOtp) {
    try {
      await triggerOTP(cfg, hittraxUsername);
    } catch (err) {
      console.error("hittrax-associate otp-trigger failed", String(err));
      return hitTraxErrorResponse(err);
    }
    console.log(`hittrax-associate otp-sent user=${hittraxUsername} ms=${Date.now() - startedAt}`);
    return jsonOk({ status: "otp_sent" });
  }

  // =========================================================================
  // MODES 1 & 3: Authenticate → Associate → persist link
  // =========================================================================

  // ---- 5. Check for existing active link ----------------------------------
  const { data: existing, error: existingErr } = await adminClient
    .from("kid_capture_links")
    .select("id, association_status")
    .eq("kid_id", kidId)
    .eq("capture_source", "hittrax")
    .maybeSingle();
  if (existingErr) return jsonError(500, "db_error", "Failed to query existing link");
  if (existing?.association_status === "active") {
    return jsonError(409, "conflict", "This kid is already linked to HitTrax. Disconnect first to re-link.");
  }

  // Generate a fresh ThirdPartyUserID for this attempt.
  // Written to DB only after HitTrax accepts.
  const thirdPartyUserId = crypto.randomUUID();

  // ---- 6. Authenticate with HitTrax ---------------------------------------
  let sessionToken: string;
  try {
    if (otpCode) {
      // Mode 3: OTP submit — ProvideOTPResponseCode → session token
      sessionToken = await submitOTPCode(cfg, hittraxUsername, otpCode);
    } else {
      // Mode 1: Password — AuthenticateCloudUser → session token
      sessionToken = await authenticateCloudUser(cfg, hittraxUsername, hittraxPassword);
    }
  } catch (err) {
    console.error("hittrax-associate auth failed", String(err));
    return hitTraxErrorResponse(err);
  }

  // ---- 7. Associate our ThirdPartyUserID with the authenticated session ---
  let thirdPartyUserPassword: string;
  try {
    thirdPartyUserPassword = await associateThirdPartyAccount(cfg, sessionToken, thirdPartyUserId);
  } catch (err) {
    console.error("hittrax-associate associate failed", String(err));
    void logOutSession(cfg, sessionToken);
    return hitTraxErrorResponse(err);
  }

  // Best-effort session logout — don't await so it doesn't add latency.
  void logOutSession(cfg, sessionToken);

  // ---- 8. Persist kid_capture_links row -----------------------------------
  // Write AFTER HitTrax success so a transient HitTrax error never strands
  // the parent. Link goes straight to 'active' in v1.3 — no pending state.
  //
  // associated_at is set 90 days in the past so the first poll window covers
  // historic swing data. last_polled_through stays NULL so hittrax-poll uses
  // associated_at as StartDate on its first run.
  const BACKFILL_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
  const backfilledAt = new Date(Date.now() - BACKFILL_WINDOW_MS).toISOString();

  let linkId: string;
  if (existing) {
    const { data: updated, error: updateErr } = await adminClient
      .from("kid_capture_links")
      .update({
        third_party_user_id: thirdPartyUserId,
        external_user_id: hittraxUsername,
        third_party_user_password: thirdPartyUserPassword,
        hittrax_registration_status: true,
        hittrax_release_status: true,
        association_status: "active",
        associated_at: backfilledAt,
        removed_at: null,
        last_polled_through: null,
        last_polled_at: null,
        last_poll_error: null,
        retry_count: 0,
        next_poll_at: null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (updateErr || !updated) return jsonError(500, "db_error", "Failed to update link");
    linkId = updated.id;
  } else {
    const { data: inserted, error: insertErr } = await adminClient
      .from("kid_capture_links")
      .insert({
        tenant_id: tenantId,
        kid_id: kidId,
        capture_source: "hittrax",
        third_party_user_id: thirdPartyUserId,
        external_user_id: hittraxUsername,
        third_party_user_password: thirdPartyUserPassword,
        hittrax_registration_status: true,
        hittrax_release_status: true,
        association_status: "active",
        associated_at: backfilledAt,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("hittrax-associate insert failed", insertErr);
      return jsonError(500, "db_error", "Failed to create link row");
    }
    linkId = inserted.id;
  }

  // ---- 9. Trigger an immediate poll so historic data loads within seconds --
  // Fire-and-forget: we do NOT await or propagate errors. The 2-minute pg_cron
  // tick is the safety net if this call fails. Duplicate swings from a race
  // with the next cron tick are absorbed by the UNIQUE on
  // (capture_source, capture_event_id) in the swings table.
  const pollUrl = `${SUPABASE_URL}/functions/v1/hittrax-poll`;
  fetch(pollUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  }).then(() => {
    console.log(`hittrax-associate immediate poll dispatched link=${linkId}`);
  }).catch((err) => {
    console.warn(`hittrax-associate immediate poll dispatch failed (non-fatal) link=${linkId}`, err);
  });

  const mode = otpCode ? "otp" : "password";
  console.log(`hittrax-associate ok mode=${mode} link=${linkId} user=${hittraxUsername} ms=${Date.now() - startedAt}`);

  return jsonOk({
    link_id: linkId,
    association_status: "active",
    hittrax_username: hittraxUsername,
  });
});
