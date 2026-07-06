// =============================================================================
// supabase/functions/hittrax-kiosk-event/index.ts
// =============================================================================
// HitTrax API v1.3 — fire a kiosk event by scanning the kiosk's QR code.
//
// Contract (POST):
//   Headers:  Authorization: Bearer <parent-jwt>
//   Body:     { kid_id: uuid, qr_url: string }
//   Response 200: { ok: true, event_type: string, kiosk_response: string }
//
// Flow:
//   1. Verify parent JWT, kid ownership, and active HitTrax link.
//   2. AuthenticateCloudUserViaThirdParty (stored credentials) → sessionToken.
//   3. Append PartnerID, APIKey, UserSessionToken to qr_url → GET it.
//   4. Best-effort LogOut the session.
//   5. Return { ok: true, event_type, kiosk_response }.
//
// Security: the qr_url origin is validated against HITTRAX_BASE_URL inside
// notifyKioskOfUserEvent to prevent the parent app from using stored creds
// to hit arbitrary URLs.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  authenticateCloudUserViaThirdParty,
  hitTraxErrorResponse,
  jsonError,
  jsonOk,
  logOutSession,
  notifyKioskOfUserEvent,
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

/** Derive a human-readable event type string from the QR URL. */
function parseEventType(qrUrl: string): string {
  try {
    const url = new URL(qrUrl);
    // Prefer an explicit EventType query param
    const explicit = url.searchParams.get("EventType") ?? url.searchParams.get("eventtype");
    if (explicit) return explicit.toLowerCase().replace(/\s+/g, "_");
    // Fall back to the last meaningful path segment
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return last.toLowerCase() || "kiosk_event";
  } catch {
    return "kiosk_event";
  }
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

  const appRole = typeof payload?.app_role === "string" ? payload.app_role : null;
  if (appRole !== "parent") return jsonError(403, "forbidden", "Only parents can use the kiosk scanner");

  // ---- 2. Parse body -------------------------------------------------------
  let body: { kid_id?: unknown; qr_url?: unknown };
  try { body = await req.json(); }
  catch { return jsonError(400, "bad_request", "Body is not valid JSON"); }

  const kidId = typeof body.kid_id === "string" ? body.kid_id.trim() : "";
  const qrUrl = typeof body.qr_url === "string" ? body.qr_url.trim() : "";
  if (!kidId) return jsonError(400, "bad_request", "kid_id required");
  if (!qrUrl) return jsonError(400, "bad_request", "qr_url required");

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

  // ---- 4. Fetch the active link -------------------------------------------
  const { data: link, error: linkErr } = await adminClient
    .from("kid_capture_links")
    .select("id, third_party_user_id, third_party_user_password, association_status")
    .eq("kid_id", kidId)
    .eq("capture_source", "hittrax")
    .maybeSingle();
  if (linkErr) return jsonError(500, "db_error", "Failed to fetch HitTrax link");
  if (!link) return jsonError(404, "not_found", "No HitTrax account linked for this kid");
  if (link.association_status !== "active") {
    return jsonError(409, "hittrax_link_not_active", "HitTrax account is not active. Please connect first.");
  }
  if (!link.third_party_user_password) {
    return jsonError(409, "hittrax_link_not_active", "HitTrax credentials not available. Please reconnect.");
  }

  // ---- 5. HitTrax config --------------------------------------------------
  const cfg = readHitTraxConfig();
  if (!cfg) return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned");

  // ---- 6. Authenticate via ThirdParty -------------------------------------
  let sessionToken: string;
  try {
    sessionToken = await authenticateCloudUserViaThirdParty(
      cfg,
      link.third_party_user_id,
      link.third_party_user_password,
    );
  } catch (err) {
    console.error("hittrax-kiosk-event auth failed", String(err));
    return hitTraxErrorResponse(err);
  }

  // ---- 7. Fire the kiosk event -------------------------------------------
  let kioskResponse: string;
  try {
    kioskResponse = await notifyKioskOfUserEvent(cfg, sessionToken, qrUrl);
  } catch (err) {
    console.error("hittrax-kiosk-event notify failed", String(err));
    void logOutSession(cfg, sessionToken);
    return hitTraxErrorResponse(err);
  }

  // ---- 8. Best-effort session logout -------------------------------------
  void logOutSession(cfg, sessionToken);

  const eventType = parseEventType(qrUrl);
  console.log(`hittrax-kiosk-event ok kid=${kidId} event=${eventType} ms=${Date.now() - startedAt}`);
  return jsonOk({ ok: true, event_type: eventType, kiosk_response: kioskResponse });
});
