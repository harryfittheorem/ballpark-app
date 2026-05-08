// =============================================================================
// supabase/functions/hittrax-associate/index.ts
// =============================================================================
// Task #118 Step 3 — Outbound association call.
//
// Contract (POST):
//   Headers:
//     Authorization: Bearer <parent-jwt>      required
//   Body (JSON):
//     { kid_id: uuid, hittrax_user_id: string }
//   Response 200:
//     {
//       link_id: uuid,
//       association_status: 'pending',
//       hittrax_registration_status: boolean,
//       hittrax_release_status: boolean
//     }
//   Errors: 401 unauthorized | 403 forbidden | 400 bad_request
//           500 db_error | 502 hittrax_error / hittrax_unreachable
//           504 hittrax_timeout | 409 conflict (kid already linked)
//           503 hittrax_not_configured
//
// Auth model:
//   * JWT verified via supabase.auth.getUser (anon-key client).
//   * tenant_id + app_role read from JWT custom claims after verification.
//   * Caller MUST own the kid (parent of family that owns the kid). Verified
//     by joining kids -> families and asserting families.parent_user_id =
//     auth.uid() AND families.tenant_id = JWT tenant_id.
//
// Lifecycle:
//   1. Insert (or RE-USE) a kid_capture_links row in 'pending'. The third_party_user_id
//      we generate is a UUID — opaque to HitTrax, never reused across re-links.
//   2. Call HitTrax AssociateThirdPartyAccount with that UUID + the parent-supplied
//      HitTrax UserID.
//   3. Persist the registration/release booleans. Status stays 'pending' until
//      the parent taps the email link and HitTrax calls our
//      hittrax-registration-complete endpoint.
//   4. Return the booleans so the UI can prompt "your HitTrax subscription
//      needs upgrading" if registration_status=false.
//
// Re-link / retry semantics:
//   * If the kid already has an ACTIVE link, return 409 conflict — they must
//     disconnect first (kid_capture_links_kid_source_unique constraint).
//   * If the kid has a 'pending' or 'declined' or 'removed' link, we update it
//     in place with a fresh third_party_user_id and re-call HitTrax. The unique
//    constraint on (capture_source, third_party_user_id) means stale
//    UUIDs are never reused.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import {
  buildHitTraxUrl,
  jsonError,
  jsonOk,
  parseAssociateResponse,
  parseHitTraxTextResponse,
  readHitTraxConfig,
} from "../_shared/hittrax.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HITTRAX_TIMEOUT_MS = 15_000;

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

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  const startedAt = Date.now();

  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed", "POST required");
  }

  // ---- 1. Auth ------------------------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonError(401, "unauthorized", "Invalid or expired token");
  }
  const userId = userData.user.id;
  const payload = decodeVerifiedJwtPayload(token);
  const tenantId = typeof payload?.tenant_id === "string" ? payload.tenant_id : null;
  const appRole = typeof payload?.app_role === "string" ? payload.app_role : null;
  if (!tenantId) return jsonError(401, "unauthorized", "Token missing tenant_id claim");
  if (appRole !== "parent") return jsonError(403, "forbidden", "Parent role required");

  // ---- 2. Body ------------------------------------------------------------
  let body: { kid_id?: unknown; hittrax_user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Body is not valid JSON");
  }
  const kidId = typeof body.kid_id === "string" ? body.kid_id : "";
  const externalUserId = typeof body.hittrax_user_id === "string" ? body.hittrax_user_id.trim() : "";
  if (!kidId) return jsonError(400, "bad_request", "kid_id required");
  if (!externalUserId) return jsonError(400, "bad_request", "hittrax_user_id required");

  // ---- 3. Verify the kid belongs to this parent ---------------------------
  const { data: kid, error: kidErr } = await adminClient
    .from("kids")
    .select("id, family_id, tenant_id:families!inner(tenant_id, parent_user_id)")
    // PostgREST nested select returns `families` as an array OR object depending
    // on cardinality; we re-validate explicitly below.
    .eq("id", kidId)
    .maybeSingle();
  if (kidErr) return jsonError(500, "db_error", "Failed to look up kid");
  if (!kid) return jsonError(403, "forbidden", "Kid not found or not yours");

  // The nested select shape is: kid = { id, family_id, tenant_id: { tenant_id, parent_user_id } }
  const family = kid.tenant_id as unknown as { tenant_id: string; parent_user_id: string } | null;
  if (
    !family ||
    family.parent_user_id !== userId ||
    family.tenant_id !== tenantId
  ) {
    return jsonError(403, "forbidden", "Kid does not belong to this parent/tenant");
  }

  // ---- 4. Read HitTrax config --------------------------------------------
  const cfg = readHitTraxConfig();
  if (!cfg) {
    return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned for this environment");
  }

  // ---- 5. UPSERT the kid_capture_links row in 'pending' -------------------
  // If a row already exists for (kid, hittrax) and is 'active', refuse so the
  // parent goes through Disconnect first (HitTrax bills per active link).
  const { data: existing, error: existingErr } = await adminClient
    .from("kid_capture_links")
    .select("id, association_status")
    .eq("kid_id", kidId)
    .eq("capture_source", "hittrax")
    .maybeSingle();
  if (existingErr) return jsonError(500, "db_error", "Failed to query existing link");
  if (existing && existing.association_status === "active") {
    return jsonError(409, "conflict", "This kid is already linked to HitTrax. Disconnect first to relink.");
  }

  // Generate a fresh ThirdPartyUserID for THIS association attempt. Never
  // reused across attempts — HitTrax's spec implies these are user-scoped
  // and we want the audit trail per attempt.
  const thirdPartyUserId = crypto.randomUUID();

  let linkId: string;
  if (existing) {
    const { data: updated, error: updateErr } = await adminClient
      .from("kid_capture_links")
      .update({
        third_party_user_id: thirdPartyUserId,
        external_user_id: externalUserId,
        third_party_user_password: null,
        hittrax_registration_status: null,
        hittrax_release_status: null,
        association_status: "pending",
        associated_at: null,
        removed_at: null,
        last_polled_through: null,
        last_polled_at: null,
        last_poll_error: null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (updateErr || !updated) return jsonError(500, "db_error", "Failed to refresh existing link");
    linkId = updated.id;
  } else {
    const { data: inserted, error: insertErr } = await adminClient
      .from("kid_capture_links")
      .insert({
        tenant_id: tenantId,
        kid_id: kidId,
        capture_source: "hittrax",
        third_party_user_id: thirdPartyUserId,
        external_user_id: externalUserId,
        association_status: "pending",
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("hittrax-associate insert failed", insertErr);
      return jsonError(500, "db_error", "Failed to create link row");
    }
    linkId = inserted.id;
  }

  // ---- 6. Call HitTrax AssociateThirdPartyAccount -------------------------
  const url = buildHitTraxUrl(cfg, "AssociateThirdPartyAccount", {
    UserID: externalUserId,
    ThirdPartyUserID: thirdPartyUserId,
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), HITTRAX_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutHandle);
    console.error("hittrax-associate fetch failed", err);
    if ((err as Error)?.name === "AbortError") {
      return jsonError(504, "hittrax_timeout", "HitTrax request timed out");
    }
    return jsonError(502, "hittrax_unreachable", "Failed to reach HitTrax");
  }
  clearTimeout(timeoutHandle);

  if (!res.ok) {
    return jsonError(502, "hittrax_error", `HitTrax returned status ${res.status}`);
  }
  const text = await res.text();
  const parsed = parseHitTraxTextResponse(text);
  if (!parsed.ok) {
    console.error(`hittrax-associate hittrax_error link=${linkId} body=${parsed.error.slice(0, 200)}`);
    return jsonError(502, "hittrax_error", parsed.error);
  }
  const booleans = parseAssociateResponse(parsed.body);
  if (!booleans) {
    console.error(`hittrax-associate hittrax_bad_response link=${linkId} body=${parsed.body.slice(0, 200)}`);
    return jsonError(502, "hittrax_bad_response", `Unexpected HitTrax response: ${parsed.body.slice(0, 80)}`);
  }

  // ---- 7. Persist the booleans -------------------------------------------
  const { error: persistErr } = await adminClient
    .from("kid_capture_links")
    .update({
      hittrax_registration_status: booleans.registration,
      hittrax_release_status: booleans.release,
    })
    .eq("id", linkId);
  if (persistErr) {
    console.error("hittrax-associate persist booleans failed", persistErr);
    // Non-fatal — the link is in pending and the booleans are informational.
  }

  console.log(
    `hittrax-associate ok link=${linkId} reg=${booleans.registration} rel=${booleans.release} ms=${Date.now() - startedAt}`,
  );

  return jsonOk({
    link_id: linkId,
    association_status: "pending",
    hittrax_registration_status: booleans.registration,
    hittrax_release_status: booleans.release,
  });
});
