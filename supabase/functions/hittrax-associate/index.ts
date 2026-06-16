// =============================================================================
// supabase/functions/hittrax-associate/index.ts
// =============================================================================
// HitTrax API v1.3 — associate a parent's kid with a HitTrax Cloud account.
//
// Contract (POST):
//   Headers:  Authorization: Bearer <parent-jwt>
//   Body:     { kid_id: uuid, hittrax_username: string, hittrax_password: string }
//   Response 200:
//     { link_id: uuid, association_status: "active", hittrax_username: string }
//   Errors:
//     401 unauthorized | 403 forbidden | 400 bad_request
//     409 conflict (kid already active) | 503 hittrax_not_configured
//     401 invalid_hittrax_credentials | 502 hittrax_error
//     504 hittrax_timeout | 502 hittrax_unreachable
//
// v1.3 Flow (three sequential HitTrax calls — no email confirmation needed):
//   1. AuthenticateCloudUser(username, password) → sessionToken
//   2. AssociateThirdPartyAccountWithCloudCredentials(sessionToken, thirdPartyUserId)
//      → thirdPartyUserPassword
//   3. LogOutThirdPartyCloudUser(sessionToken)   [best-effort cleanup]
//   4. Upsert kid_capture_links: status = 'active', password stored.
//
// The link goes DIRECTLY to 'active' — no pending/email-confirmation step.
// The thirdPartyUserId (our UUID) + thirdPartyUserPassword are the permanent
// credentials for all future HitTrax calls on behalf of this kid. The raw
// HitTrax password is never stored or logged.
//
// Re-link semantics:
//   * Active link → 409 (disconnect first).
//   * Pending/declined/removed → upsert in-place with fresh UUID + new password.
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

  // ---- 2. Parse body -------------------------------------------------------
  let body: { kid_id?: unknown; hittrax_username?: unknown; hittrax_password?: unknown };
  try { body = await req.json(); }
  catch { return jsonError(400, "bad_request", "Body is not valid JSON"); }

  const kidId = typeof body.kid_id === "string" ? body.kid_id : "";
  const hittraxUsername = typeof body.hittrax_username === "string" ? body.hittrax_username.trim() : "";
  const hittraxPassword = typeof body.hittrax_password === "string" ? body.hittrax_password : "";
  if (!kidId) return jsonError(400, "bad_request", "kid_id required");
  if (!hittraxUsername) return jsonError(400, "bad_request", "hittrax_username required");
  if (!hittraxPassword) return jsonError(400, "bad_request", "hittrax_password required");

  // ---- 3. Verify kid ownership --------------------------------------------
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

  // ---- 4. HitTrax config --------------------------------------------------
  const cfg = readHitTraxConfig();
  if (!cfg) return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned for this environment");

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

  // Generate a fresh ThirdPartyUserID for this attempt (opaque UUID — never
  // reused across re-links). Written to DB only after HitTrax accepts.
  const thirdPartyUserId = crypto.randomUUID();

  // ---- 6. HitTrax v1.3 three-step flow ------------------------------------
  // Step 6a: Authenticate with HitTrax username + password → session token.
  // Throws invalid_hittrax_credentials if the credentials are wrong.
  let sessionToken: string;
  try {
    sessionToken = await authenticateCloudUser(cfg, hittraxUsername, hittraxPassword);
  } catch (err) {
    console.error("hittrax-associate auth failed", String(err));
    return hitTraxErrorResponse(err);
  }

  // Step 6b: Associate our ThirdPartyUserID with the authenticated session.
  // Returns the ThirdPartyUserPassword — our permanent credential for this kid.
  let thirdPartyUserPassword: string;
  try {
    thirdPartyUserPassword = await associateThirdPartyAccount(cfg, sessionToken, thirdPartyUserId);
  } catch (err) {
    console.error("hittrax-associate associate failed", String(err));
    // Best-effort logout even if association failed.
    void logOutSession(cfg, sessionToken);
    return hitTraxErrorResponse(err);
  }

  // Step 6c: Log out the session (best-effort — don't fail the request if this errors).
  void logOutSession(cfg, sessionToken);

  // ---- 7. Persist kid_capture_links row -----------------------------------
  // Write AFTER HitTrax success so a transient HitTrax error never strands the
  // parent in a bad state. The link goes straight to 'active' in v1.3 —
  // no email confirmation / pending state needed.
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
        associated_at: new Date().toISOString(),
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
        associated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("hittrax-associate insert failed", insertErr);
      return jsonError(500, "db_error", "Failed to create link row");
    }
    linkId = inserted.id;
  }

  console.log(`hittrax-associate ok link=${linkId} user=${hittraxUsername} ms=${Date.now() - startedAt}`);

  return jsonOk({
    link_id: linkId,
    association_status: "active",
    hittrax_username: hittraxUsername,
  });
});
