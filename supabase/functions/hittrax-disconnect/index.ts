// =============================================================================
// supabase/functions/hittrax-disconnect/index.ts
// =============================================================================
// HitTrax API v1.3 — remove a kid's association with HitTrax.
//
// Contract (POST):
//   Headers:  Authorization: Bearer <parent-jwt>
//   Body:     { kid_id: uuid }
//   Response 200: { ok: true, link_id: uuid }
//
// v1.3 Flow (for active links):
//   1. AuthenticateCloudUserViaThirdParty(thirdPartyUserId, thirdPartyPassword)
//      → sessionToken
//   2. RemoveThirdPartyAssociationFromCloudUser(sessionToken)
//   3. LogOutThirdPartyCloudUser(sessionToken)   [best-effort cleanup]
//   4. Update kid_capture_links: status = 'removed', clear password.
//
// For pending/declined links (v1.x legacy users without a thirdPartyPassword):
//   Skip the HitTrax API calls — no active association exists on HitTrax side.
//   Flip local status to 'removed'.
//
// Order matters: HitTrax call FIRST so their billing side reflects the
// removal. Only flip the local row after HitTrax confirms. If HitTrax
// errors, leave the row 'active' so the parent can retry.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  authenticateCloudUserViaThirdParty,
  hitTraxErrorResponse,
  jsonError,
  jsonOk,
  logOutSession,
  readHitTraxConfig,
  removeThirdPartyAssociation,
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
  if (!tenantId) return jsonError(401, "unauthorized", "Token missing tenant_id claim");

  // ---- 2. Parse body -------------------------------------------------------
  let body: { kid_id?: unknown };
  try { body = await req.json(); }
  catch { return jsonError(400, "bad_request", "Body is not valid JSON"); }

  const kidId = typeof body.kid_id === "string" ? body.kid_id : "";
  if (!kidId) return jsonError(400, "bad_request", "kid_id required");

  // ---- 3. Verify kid ownership --------------------------------------------
  const { data: kid } = await adminClient
    .from("kids")
    .select("id, family_id, families!inner(tenant_id, parent_user_id)")
    .eq("id", kidId)
    .maybeSingle();
  const family = (kid as unknown as { families: { tenant_id: string; parent_user_id: string } } | null)?.families;
  if (!family || family.parent_user_id !== userId || family.tenant_id !== tenantId) {
    return jsonError(403, "forbidden", "Kid does not belong to this parent/tenant");
  }

  // ---- 4. Fetch the link --------------------------------------------------
  const { data: link, error: linkErr } = await adminClient
    .from("kid_capture_links")
    .select("id, third_party_user_id, third_party_user_password, association_status")
    .eq("kid_id", kidId)
    .eq("capture_source", "hittrax")
    .maybeSingle();
  if (linkErr) return jsonError(500, "db_error", "Failed to fetch link");
  if (!link) return jsonError(404, "not_found", "No HitTrax link for this kid");
  if (link.association_status === "removed") {
    return jsonOk({ ok: true, link_id: link.id, already_removed: true });
  }

  // ---- 5. HitTrax config --------------------------------------------------
  const cfg = readHitTraxConfig();
  if (!cfg) return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned");

  // ---- 6. Call HitTrax to remove the association (active links only) ------
  // Only active v1.3 links have a thirdPartyUserPassword. Legacy pending/
  // declined links (v1.x era, no password) had no confirmed association on
  // HitTrax's side, so we skip the API call and just flip locally.
  if (link.association_status === "active" && link.third_party_user_password) {
    // Step 6a: Authenticate via ThirdPartyUserID + ThirdPartyUserPassword
    let sessionToken: string;
    try {
      sessionToken = await authenticateCloudUserViaThirdParty(
        cfg,
        link.third_party_user_id,
        link.third_party_user_password,
      );
    } catch (err) {
      console.error("hittrax-disconnect auth failed", String(err));
      return hitTraxErrorResponse(err);
    }

    // Step 6b: Remove association (requires session token in v1.3)
    try {
      await removeThirdPartyAssociation(cfg, sessionToken);
    } catch (err) {
      console.error("hittrax-disconnect remove failed", String(err));
      void logOutSession(cfg, sessionToken);
      return hitTraxErrorResponse(err);
    }

    // Step 6c: Log out session (best-effort)
    void logOutSession(cfg, sessionToken);
  } else {
    console.log(`hittrax-disconnect skipping HitTrax call for status=${link.association_status} (no active v1.3 link)`);
  }

  // ---- 7. Flip local row to 'removed' -------------------------------------
  const { error: updateErr } = await adminClient
    .from("kid_capture_links")
    .update({
      association_status: "removed",
      removed_at: new Date().toISOString(),
      third_party_user_password: null,
    })
    .eq("id", link.id);
  if (updateErr) return jsonError(500, "db_error", "Failed to mark link removed");

  console.log(`hittrax-disconnect ok link=${link.id} ms=${Date.now() - startedAt}`);
  return jsonOk({ ok: true, link_id: link.id });
});
