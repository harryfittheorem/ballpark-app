// =============================================================================
// supabase/functions/ForgetHitTraxUser/index.ts
// =============================================================================
// Inbound ForgetHitTraxUser endpoint — HitTrax-spec endpoint name (GDPR/COPPA).
//
// This is the canonical endpoint name required by the HitTrax Third Party Data
// Sharing API v1.0 spec. HitTrax calls this endpoint when a user has elected
// to be "forgotten". Per spec, the third party MUST delete all HitTrax-derived
// data and the HitTrax-issued password. We:
//
//   1. Verify PartnerID + APIKey (same constant-time check as the
//      registration-complete callback — there is no other auth mechanism).
//   2. Look up kid_capture_links by ThirdPartyUserID.
//   3. Verify the inbound ThirdPartyUserPassword matches what we have stored
//      for that link (extra defense-in-depth on top of PartnerID check —
//      prevents a HitTrax operator with leaked partner creds from forgetting
//      arbitrary users without also knowing the per-user password).
//   4. Delete sessions + swings + personal_bests for that kid where
//      capture_source = 'hittrax'. (We do NOT delete the kid or the family —
//      just the HitTrax-derived data.)
//   5. Mark the link 'removed' and clear the password.
//   6. Return PLAIN TEXT "true" or "Error <reason>".
//
// Callback URLs to give HitTrax:
//   https://exjcwvvglthnxerzpukw.supabase.co/functions/v1/ForgetHitTraxUser
//
// Deploy:
//   npx supabase functions deploy ForgetHitTraxUser --no-verify-jwt
//
// Idempotency: a re-delivered Forget call after the data is already gone
// returns "true" (the link is removed, swings query returns 0 rows).
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  hittraxText,
  readHitTraxConfig,
  timingSafeEqual,
  verifyHitTraxInbound,
} from "../_shared/hittrax.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  const startedAt = Date.now();

  if (req.method !== "POST" && req.method !== "GET") {
    return hittraxText("Error Method Not Allowed", 405);
  }

  const cfg = readHitTraxConfig();
  if (!cfg) {
    console.error("ForgetHitTraxUser: HITTRAX_* secrets not configured");
    return hittraxText("Error Internal Exception", 500);
  }

  const url = new URL(req.url);
  const auth = verifyHitTraxInbound(url, cfg);
  if (!auth.ok) {
    console.error(`ForgetHitTraxUser auth_failed code=${auth.code}`);
    return hittraxText(`Error ${auth.message}`, auth.status);
  }

  const tpuid = url.searchParams.get("ThirdPartyUserID");
  const password = url.searchParams.get("ThirdPartyUserPassword");
  if (!tpuid) return hittraxText("Error Missing Third Party UserID", 400);
  if (!password) return hittraxText("Error Missing Third Party User Password", 400);

  const { data: link, error: lookupErr } = await adminClient
    .from("kid_capture_links")
    .select("id, kid_id, third_party_user_password, association_status")
    .eq("capture_source", "hittrax")
    .eq("third_party_user_id", tpuid)
    .maybeSingle();
  if (lookupErr) {
    console.error("ForgetHitTraxUser db error on lookup", lookupErr);
    return hittraxText("Error Internal Exception", 500);
  }
  if (!link) {
    // Already forgotten — ack to stop HitTrax retries.
    console.log(`ForgetHitTraxUser noop tpuid=${tpuid.slice(0, 8)}…`);
    return hittraxText("true");
  }

  // Defense-in-depth: per-user password check. If the link is already
  // removed (no password on file), accept the call as a no-op.
  if (link.third_party_user_password) {
    if (!timingSafeEqual(password, link.third_party_user_password)) {
      return hittraxText("Error Invalid Third Party User Login", 401);
    }
  }

  // Delete the HitTrax-derived data for this kid. We must NOT touch
  // sessions / swings / PRs from other capture sources (Rapsodo, manual)
  // and we don't touch the kid / family / points balance — only
  // HitTrax-sourced rows.
  //
  // Order matters: PBs first (while we can still resolve swing_id ->
  // capture_source). Then swings. Then sessions.

  // 1) Pull every HitTrax swing id for this kid so we can scope the PB delete
  //    by swing_id (not by kid_id, which would also nuke Rapsodo/manual PBs).
  const { data: hittraxSwingIds, error: swingIdsErr } = await adminClient
    .from("swings")
    .select("id")
    .eq("kid_id", link.kid_id)
    .eq("capture_source", "hittrax");
  if (swingIdsErr) {
    console.error("ForgetHitTraxUser fetch hittrax swing ids failed", swingIdsErr);
    return hittraxText("Error Internal Exception", 500);
  }
  const idList = (hittraxSwingIds ?? []).map((r: { id: string }) => r.id);

  // 2) Delete only personal_bests whose achieving swing is a HitTrax swing.
  //    PBs whose swing came from another source survive untouched.
  if (idList.length > 0) {
    const { error: delPbErr } = await adminClient
      .from("personal_bests")
      .delete()
      .eq("kid_id", link.kid_id)
      .in("swing_id", idList);
    if (delPbErr) {
      console.error("ForgetHitTraxUser delete personal_bests failed", delPbErr);
      return hittraxText("Error Internal Exception", 500);
    }
  }

  // 3) Delete the swings themselves.
  const { error: delSwingsErr } = await adminClient
    .from("swings")
    .delete()
    .eq("kid_id", link.kid_id)
    .eq("capture_source", "hittrax");
  if (delSwingsErr) {
    console.error("ForgetHitTraxUser delete swings failed", delSwingsErr);
    return hittraxText("Error Internal Exception", 500);
  }

  // 4) Delete the sessions.
  const { error: delSessionsErr } = await adminClient
    .from("sessions")
    .delete()
    .eq("kid_id", link.kid_id)
    .eq("capture_source", "hittrax");
  if (delSessionsErr) {
    console.error("ForgetHitTraxUser delete sessions failed", delSessionsErr);
    return hittraxText("Error Internal Exception", 500);
  }

  const { error: linkErr } = await adminClient
    .from("kid_capture_links")
    .update({
      association_status: "removed",
      removed_at: new Date().toISOString(),
      third_party_user_password: null,
    })
    .eq("id", link.id);
  if (linkErr) {
    console.error("ForgetHitTraxUser update link failed", linkErr);
    return hittraxText("Error Internal Exception", 500);
  }

  console.log(`ForgetHitTraxUser ok link=${link.id} ms=${Date.now() - startedAt}`);
  return hittraxText("true");
});
