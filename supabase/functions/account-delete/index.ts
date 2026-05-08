// =============================================================================
// supabase/functions/account-delete/index.ts
// =============================================================================
// Task #118 Step 8c — Outbound GDPR/COPPA propagation on parent account delete.
//
// Contract (POST):
//   Headers: Authorization: Bearer <parent-jwt>
//   Body: {} (empty)
//   Response 200: { ok: true, hittrax_links_purged: number, kids_purged: number }
//
// Flow (in order — each step's failure mode is documented):
//   1. Verify the caller's JWT and recover their user_id + tenant_id claim.
//   2. Look up the family + every kid owned by this parent.
//   3. For every active hittrax kid_capture_link, call HitTrax outbound
//      (RemoveThirdPartyAssociation) so HitTrax stops sending us data and
//      the active-association count drops on their billing side. Failures
//      are logged but do NOT block account deletion — the parent has
//      requested deletion and we owe them deletion.
//   4. Hard-delete kid_capture_links rows (so the password column is
//      destroyed, not just nulled).
//   5. Call supabaseAdmin.auth.admin.deleteUser(userId) — the database FK
//      cascade then removes families, kids, and all per-kid data.
//
// Why this is the OUTBOUND counterpart to hittrax-forget:
//   - hittrax-forget is HitTrax-INITIATED (HitTrax POSTs us when their user
//     requests data deletion through HitTrax). It removes ONLY the
//     HitTrax-sourced rows for one specific link.
//   - account-delete is BALLPARK-INITIATED (parent taps Delete Account in
//     the app). It walks every kid in the family, calls the HitTrax
//     outbound disconnect for each active link, and then deletes the auth
//     user. The two functions cover the two propagation directions; see
//     docs/HITTRAX_INTEGRATION.md.
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

// Per-link outbound budget. A hung HitTrax must not block a deletion the
// parent has explicitly asked for.
const HITTRAX_TIMEOUT_MS = 10_000;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function decodeJwtPayload(token: string): Record<string, unknown> | null {
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

async function callHitTraxOutbound(
  cfg: { baseUrl: string; partnerId: string; apiKey: string },
  endpoint: "RemoveThirdPartyAssociation" | "ForgetHitTraxUser",
  thirdPartyUserId: string,
  thirdPartyUserPassword: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = buildHitTraxUrl(cfg, endpoint, {
    ThirdPartyUserID: thirdPartyUserId,
    ThirdPartyUserPassword: thirdPartyUserPassword,
  });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HITTRAX_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", signal: ac.signal });
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, reason: (err as Error)?.name === "AbortError" ? "timeout" : "unreachable" };
  }
  clearTimeout(timer);
  if (!res.ok) return { ok: false, reason: `status_${res.status}` };
  const text = await res.text();
  const parsed = parseHitTraxTextResponse(text);
  if (!parsed.ok) return { ok: false, reason: parsed.error.slice(0, 200) };
  return { ok: true };
}

serve(async (req) => {
  const startedAt = Date.now();

  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "POST required");

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();

  // Cryptographically verify the JWT by asking Supabase auth to resolve it
  // to a user. This rejects expired/forged tokens.
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

  // Find the family + kids for this parent.
  const { data: family, error: famErr } = await adminClient
    .from("families")
    .select("id, tenant_id")
    .eq("parent_user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (famErr) return jsonError(500, "db_error", "Failed to fetch family");

  let hittraxLinksPurged = 0;
  let kidsPurged = 0;

  if (family) {
    const { data: kids } = await adminClient
      .from("kids")
      .select("id")
      .eq("family_id", family.id);
    const kidIds = (kids ?? []).map((k) => k.id);
    kidsPurged = kidIds.length;

    if (kidIds.length > 0) {
      // Look up every kid_capture_link we need to walk. We project the
      // password explicitly here (admin client bypasses the column-level
      // GRANT) — the value never leaves this function; we use it only for
      // the outbound HitTrax call and then hard-delete the row.
      const { data: links } = await adminClient
        .from("kid_capture_links")
        .select("id, capture_source, association_status, third_party_user_id, third_party_user_password")
        .in("kid_id", kidIds);

      const cfg = readHitTraxConfig();
      // Outbound HitTrax cleanup in parallel — best-effort. Two calls per
      // active link, in this order:
      //   (a) RemoveThirdPartyAssociation — stops HitTrax from sending us
      //       new data and decrements the active-association count on
      //       their billing side.
      //   (b) ForgetHitTraxUser — GDPR/COPPA outbound: instructs HitTrax
      //       to forget the per-association credential they minted for
      //       this kid. Without this the HitTrax-side ThirdPartyUserID
      //       persists indefinitely even though we've deleted the row
      //       on our side.
      // A HitTrax failure on either call MUST NOT block the deletion (the
      // parent asked us to delete; we cannot hold them hostage to a
      // third-party outage). Failures are logged for ops follow-up.
      const outbound: Promise<unknown>[] = [];
      for (const link of links ?? []) {
        if (
          link.capture_source === "hittrax" &&
          link.association_status === "active" &&
          link.third_party_user_id &&
          link.third_party_user_password &&
          cfg
        ) {
          const tpid = link.third_party_user_id;
          const tpwd = link.third_party_user_password;
          outbound.push(
            callHitTraxOutbound(cfg, "RemoveThirdPartyAssociation", tpid, tpwd).then((r) => {
              if (!r.ok) {
                console.error(`account-delete hittrax remove failed link=${link.id} reason=${r.reason}`);
              }
            }),
          );
          outbound.push(
            callHitTraxOutbound(cfg, "ForgetHitTraxUser", tpid, tpwd).then((r) => {
              if (!r.ok) {
                console.error(`account-delete hittrax forget failed link=${link.id} reason=${r.reason}`);
              }
            }),
          );
        }
      }
      if (outbound.length > 0) await Promise.allSettled(outbound);

      // Hard-delete the link rows. This destroys the password column on
      // disk (vs the soft-flip-to-removed that hittrax-disconnect does
      // for a single-link deactivation). Cascade on the user delete will
      // also remove these via families → kids, but we delete explicitly
      // here so the password column is gone before we even ask
      // auth.admin.deleteUser to fire.
      const { error: delLinksErr } = await adminClient
        .from("kid_capture_links")
        .delete()
        .in("kid_id", kidIds);
      if (delLinksErr) {
        console.error("account-delete delete kid_capture_links failed", delLinksErr);
      } else {
        hittraxLinksPurged = links?.length ?? 0;
      }
    }
  }

  // Auth-level user deletion. This cascades to public.families (FK), which
  // cascades to public.kids, which cascades to swings/personal_bests/
  // bookings/orders/etc — see the migration FK definitions.
  const { error: delUserErr } = await adminClient.auth.admin.deleteUser(userId);
  if (delUserErr) {
    console.error("account-delete deleteUser failed", delUserErr);
    return jsonError(500, "auth_delete_failed", delUserErr.message);
  }

  console.log(
    `account-delete ok user=${userId} kids=${kidsPurged} hittrax_links=${hittraxLinksPurged} ms=${Date.now() - startedAt}`,
  );
  return jsonOk({ ok: true, hittrax_links_purged: hittraxLinksPurged, kids_purged: kidsPurged });
});
