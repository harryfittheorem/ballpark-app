// =============================================================================
// supabase/functions/hittrax-registration-complete/index.ts
// =============================================================================
// Task #118 Step 4 — Inbound CompleteHitTraxRegistration callback.
//
// HitTrax calls this endpoint after the user taps Accept/Decline in the email
// HitTrax sent them following our AssociateThirdPartyAccount call. Per spec:
//
//   POST <our-base-url>/CompleteHitTraxRegistration
//        ?PartnerID=<PID>&APIKey=<SECRET>
//        &ThirdPartyUserID=<UUID>&Accepted=<true|false>
//        &ThirdPartyUserPassword=<HITTRAX_ISSUED_PASSWORD>
//
// We:
//   1. Verify PartnerID + APIKey in constant time (the entire HitTrax inbound
//      auth model — there is NO HMAC, NO bearer token, NO OAuth in v1.0).
//   2. Look up kid_capture_links by ThirdPartyUserID.
//   3. If Accepted=true: persist password, flip status -> 'active',
//      seed last_polled_through = associated_at = now.
//   4. If Accepted=false: flip status -> 'declined'.
//   5. Return PLAIN TEXT "true" on success or "Error <reason>" on failure
//      (HitTrax expects this exact wire format — see Appendix on page 12).
//
// Deploy:
//   npx supabase functions deploy hittrax-registration-complete --no-verify-jwt
//
// Idempotency (CRITICAL — re-delivery must NEVER lose data):
//   * The same Accepted=true callback may be re-delivered (HitTrax network
//     retry, at-least-once delivery semantics). The active-link branch
//     short-circuits BEFORE touching last_polled_through or associated_at
//     because re-running the UPDATE would jump the cursor forward to "now"
//     and silently skip every swing the poller hasn't yet ingested in the
//     window between original activation and re-delivery. The only state
//     we refresh on re-delivery is the password (in case HitTrax rotated
//     it) — and that's gated by `.neq()` so it's a no-op when unchanged.
//   * If a callback for an already-removed link arrives, we treat it as a
//     no-op and return "true" — there's nothing to do, and erroring would
//     make HitTrax retry forever.
//   * declined → accepted re-delivery is a real state change (parent
//     re-tried via associate), so we proceed with the normal activate
//     path and seed the cursor at "now".
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import {
  hittraxText,
  readHitTraxConfig,
  verifyHitTraxInbound,
} from "../_shared/hittrax.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  const startedAt = Date.now();

  // HitTrax sends POST per spec; tolerate GET too because some implementations
  // use GET for query-param-only endpoints.
  if (req.method !== "POST" && req.method !== "GET") {
    return hittraxText("Error Method Not Allowed", 405);
  }

  const cfg = readHitTraxConfig();
  if (!cfg) {
    console.error("hittrax-registration-complete: HITTRAX_* secrets not configured");
    return hittraxText("Error Internal Exception", 500);
  }

  const url = new URL(req.url);
  const auth = verifyHitTraxInbound(url, cfg);
  if (!auth.ok) {
    console.error(
      `hittrax-registration-complete auth_failed code=${auth.code} ms=${Date.now() - startedAt}`,
    );
    return hittraxText(`Error ${auth.message}`, auth.status);
  }

  const tpuid = url.searchParams.get("ThirdPartyUserID");
  const acceptedRaw = url.searchParams.get("Accepted");
  const password = url.searchParams.get("ThirdPartyUserPassword");

  if (!tpuid) return hittraxText("Error Missing Third Party UserID", 400);
  if (acceptedRaw === null) return hittraxText("Error Missing Accepted", 400);
  // Strict ∈ {true,false} parse — anything else is a malformed callback and
  // MUST 400 rather than silently being treated as decline (which would
  // mutate the link to 'declined' on a spec-violating payload).
  const acceptedNorm = acceptedRaw.trim().toLowerCase();
  if (acceptedNorm !== "true" && acceptedNorm !== "false") {
    return hittraxText("Error Invalid Accepted value", 400);
  }
  const accepted = acceptedNorm === "true";

  if (accepted && (!password || password.length === 0)) {
    return hittraxText("Error Missing Third Party User Password", 400);
  }

  // Look up the link by third_party_user_id.
  const { data: link, error: lookupErr } = await adminClient
    .from("kid_capture_links")
    .select("id, association_status, kid_id, tenant_id")
    .eq("capture_source", "hittrax")
    .eq("third_party_user_id", tpuid)
    .maybeSingle();
  if (lookupErr) {
    console.error("hittrax-registration-complete db error on lookup", lookupErr);
    return hittraxText("Error Internal Exception", 500);
  }
  if (!link) {
    // Per spec error table: "No Third Party User found".
    console.warn(`hittrax-registration-complete no_link tpuid=${tpuid.slice(0, 8)}…`);
    return hittraxText("Error No Third Party User found", 404);
  }

  // If link is already removed, ack and noop — HitTrax should not retry.
  if (link.association_status === "removed") {
    console.log(
      `hittrax-registration-complete noop link=${link.id} status=removed ms=${Date.now() - startedAt}`,
    );
    return hittraxText("true");
  }

  if (accepted) {
    // IDEMPOTENCY: HitTrax may re-deliver the same Accepted=true callback
    // (network retry, at-least-once delivery). A re-delivery for an
    // already-active link MUST be a true no-op — re-running the UPDATE
    // would clobber `last_polled_through` back to "now", silently
    // skipping every swing the poller has not yet ingested in the
    // window between the original activation and the re-delivery. The
    // only state we are willing to refresh on a re-delivery is the
    // password, in case HitTrax rotated it (the spec doesn't mandate it
    // but the password we store is the one HitTrax just sent — keeping
    // them in sync is safe). The cursor + activation timestamp are
    // ABSOLUTELY frozen post-activation.
    if (link.association_status === "active") {
      if (password) {
        const { error: pwErr } = await adminClient
          .from("kid_capture_links")
          .update({ third_party_user_password: password })
          .eq("id", link.id)
          .neq("third_party_user_password", password); // skip write if unchanged
        if (pwErr) {
          console.error("hittrax-registration-complete db error on password refresh", pwErr);
          // Best-effort: still ack so HitTrax doesn't retry forever.
        }
      }
      console.log(
        `hittrax-registration-complete noop_active link=${link.id} ms=${Date.now() - startedAt}`,
      );
      return hittraxText("true");
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await adminClient
      .from("kid_capture_links")
      .update({
        association_status: "active",
        third_party_user_password: password,
        associated_at: now,
        // Seed cursor at activation time so the first poll only fetches
        // swings recorded from now onward. Backfill is intentionally not
        // attempted in v1 — see runbook. Guarded above so this only ever
        // runs on the first accepted callback.
        last_polled_through: now,
        // Reset any backoff state from previous failed pending attempts.
        retry_count: 0,
        next_poll_at: null,
        last_poll_error: null,
      })
      .eq("id", link.id);
    if (updateErr) {
      console.error("hittrax-registration-complete db error on accept update", updateErr);
      return hittraxText("Error Internal Exception", 500);
    }
    console.log(
      `hittrax-registration-complete accepted link=${link.id} ms=${Date.now() - startedAt}`,
    );
  } else {
    const { error: updateErr } = await adminClient
      .from("kid_capture_links")
      .update({
        association_status: "declined",
        third_party_user_password: null,
      })
      .eq("id", link.id);
    if (updateErr) {
      console.error("hittrax-registration-complete db error on decline update", updateErr);
      return hittraxText("Error Internal Exception", 500);
    }
    console.log(
      `hittrax-registration-complete declined link=${link.id} ms=${Date.now() - startedAt}`,
    );
  }

  return hittraxText("true");
});
