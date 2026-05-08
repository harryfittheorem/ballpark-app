// =============================================================================
// supabase/functions/hittrax-disconnect/index.ts
// =============================================================================
// Task #118 Step 8a — Outbound RemoveThirdPartyAssociation.
//
// Contract (POST):
//   Headers: Authorization: Bearer <parent-jwt>
//   Body: { kid_id: uuid }
//   Response 200: { ok: true, link_id }
//
// Calls HitTrax RemoveThirdPartyAssociation, then flips the local link to
// 'removed'. Order matters: we call HitTrax FIRST so the active-association
// count drops on their billing side; only then do we flip the row locally.
// If HitTrax errors, we leave the row 'active' so the next attempt retries.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import {
  buildHitTraxUrl,
  jsonError,
  jsonOk,
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

  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "POST required");

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
  if (userErr || !userData?.user) return jsonError(401, "unauthorized", "Invalid or expired token");
  const userId = userData.user.id;

  const payload = decodeVerifiedJwtPayload(token);
  const tenantId = typeof payload?.tenant_id === "string" ? payload.tenant_id : null;
  if (!tenantId) return jsonError(401, "unauthorized", "Token missing tenant_id claim");

  let body: { kid_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Body is not valid JSON");
  }
  const kidId = typeof body.kid_id === "string" ? body.kid_id : "";
  if (!kidId) return jsonError(400, "bad_request", "kid_id required");

  // Verify ownership.
  const { data: kid } = await adminClient
    .from("kids")
    .select("id, family_id, families!inner(tenant_id, parent_user_id)")
    .eq("id", kidId)
    .maybeSingle();
  const family = (kid as unknown as { families: { tenant_id: string; parent_user_id: string } } | null)?.families;
  if (!family || family.parent_user_id !== userId || family.tenant_id !== tenantId) {
    return jsonError(403, "forbidden", "Kid does not belong to this parent/tenant");
  }

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

  const cfg = readHitTraxConfig();
  if (!cfg) return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned");

  // Call HitTrax FIRST so their billing side reflects the removal. We only
  // have a password to pass if the link was 'active'; for 'pending'/'declined'
  // we have nothing to remove on HitTrax — just flip locally.
  if (link.association_status === "active" && link.third_party_user_password) {
    const url = buildHitTraxUrl(cfg, "RemoveThirdPartyAssociation", {
      ThirdPartyUserID: link.third_party_user_id,
      ThirdPartyUserPassword: link.third_party_user_password,
    });
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), HITTRAX_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", signal: controller.signal });
    } catch (err) {
      clearTimeout(timeoutHandle);
      if ((err as Error)?.name === "AbortError") return jsonError(504, "hittrax_timeout", "HitTrax timed out");
      return jsonError(502, "hittrax_unreachable", "Failed to reach HitTrax");
    }
    clearTimeout(timeoutHandle);
    if (!res.ok) return jsonError(502, "hittrax_error", `HitTrax returned status ${res.status}`);
    const text = await res.text();
    const parsed = parseHitTraxTextResponse(text);
    if (!parsed.ok) {
      console.error(`hittrax-disconnect hittrax_error link=${link.id} body=${parsed.error.slice(0, 200)}`);
      return jsonError(502, "hittrax_error", parsed.error);
    }
  }

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
