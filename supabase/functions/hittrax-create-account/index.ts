// =============================================================================
// supabase/functions/hittrax-create-account/index.ts
// =============================================================================
// Creates a new HitTrax Cloud account for the parent's kid and immediately
// links it to our system — no separate association step required.
//
// Two modes (POST):
//   Mode A — Username availability check (fast, no DB write):
//     Body: { check_username: string }
//     Response: { available: boolean }
//
//   Mode B — Create account:
//     Body: { kid_id, hittrax_username, password, sport, skill_level,
//             gender, position?, bats?, throws?, height_inches? }
//     Response: { link_id, association_status: "active", hittrax_username }
//
// v1.3 Create flow:
//   1. CreateCloudUserAccount(username, password, profile...) → ThirdPartyUserPassword
//   2. Upsert kid_capture_links: status='active', credentials stored.
//
// COPPA guard: if kid's DOB puts them under 13, the parent's email is sent as
// GuardianEmailAddress (required by HitTrax for COPPA compliance).
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  checkCloudUsernameEligibility,
  createCloudUserAccount,
  hitTraxErrorResponse,
  jsonError,
  jsonOk,
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

/** Convert ISO date string (YYYY-MM-DD) → MM/DD/YYYY for HitTrax. */
function isoToHitTraxDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

/** Return age in years given an ISO date_of_birth string. */
function ageFromDOB(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
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
  const parentEmail = userData.user.email ?? "";

  const jwtPayload = decodeJwtPayload(token);
  const tenantId = typeof jwtPayload?.tenant_id === "string" ? jwtPayload.tenant_id : null;
  const appRole = typeof jwtPayload?.app_role === "string" ? jwtPayload.app_role : null;
  if (!tenantId) return jsonError(401, "unauthorized", "Token missing tenant_id claim");
  if (appRole !== "parent") return jsonError(403, "forbidden", "Parent role required");

  // ---- 2. Parse body -------------------------------------------------------
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return jsonError(400, "bad_request", "Body is not valid JSON"); }

  // ---- 3. HitTrax config (required for both modes) ------------------------
  const cfg = readHitTraxConfig();
  if (!cfg) return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned for this environment");

  // =========================================================================
  // MODE A: Username availability check
  // =========================================================================
  if (typeof body.check_username === "string") {
    const username = body.check_username.trim();
    if (!username) return jsonError(400, "bad_request", "check_username must be a non-empty string");
    try {
      const available = await checkCloudUsernameEligibility(cfg, username);
      return jsonOk({ available });
    } catch (err) {
      console.error("hittrax-create-account username-check failed", String(err));
      return hitTraxErrorResponse(err);
    }
  }

  // =========================================================================
  // MODE B: Create account
  // =========================================================================
  const kidId = typeof body.kid_id === "string" ? body.kid_id.trim() : "";
  const hittraxUsername = typeof body.hittrax_username === "string" ? body.hittrax_username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const sport = typeof body.sport === "string" ? body.sport : "";
  const skillLevel = typeof body.skill_level === "string" ? body.skill_level : "";
  const gender = typeof body.gender === "string" ? body.gender : "";
  const position = typeof body.position === "string" ? body.position || undefined : undefined;
  const bats = typeof body.bats === "string" ? body.bats || undefined : undefined;
  const throws_ = typeof body.throws === "string" ? body.throws || undefined : undefined;
  const heightInches = typeof body.height_inches === "number" ? body.height_inches : undefined;

  if (!kidId) return jsonError(400, "bad_request", "kid_id required");
  if (!hittraxUsername) return jsonError(400, "bad_request", "hittrax_username required");
  if (!password) return jsonError(400, "bad_request", "password required");
  if (!sport) return jsonError(400, "bad_request", "sport required");
  if (!skillLevel) return jsonError(400, "bad_request", "skill_level required");
  if (!gender) return jsonError(400, "bad_request", "gender required");

  // ---- 4. Verify kid ownership + read profile -----------------------------
  const { data: kid, error: kidErr } = await adminClient
    .from("kids")
    .select("id, first_name, last_name, date_of_birth, primary_position, family_id")
    .eq("id", kidId)
    .maybeSingle();
  if (kidErr) return jsonError(500, "db_error", "Failed to look up kid");
  if (!kid) return jsonError(403, "forbidden", "Kid not found or not yours");

  // Verify parent owns this kid
  const { data: family, error: famErr } = await adminClient
    .from("families")
    .select("tenant_id, parent_user_id")
    .eq("id", kid.family_id)
    .maybeSingle();
  if (famErr) return jsonError(500, "db_error", "Failed to look up family");
  if (!family || family.parent_user_id !== userId || family.tenant_id !== tenantId) {
    return jsonError(403, "forbidden", "Kid does not belong to this parent/tenant");
  }

  // ---- 5. Check for existing active link ----------------------------------
  const { data: existing, error: existingErr } = await adminClient
    .from("kid_capture_links")
    .select("id, association_status")
    .eq("kid_id", kidId)
    .eq("capture_source", "hittrax")
    .maybeSingle();
  if (existingErr) return jsonError(500, "db_error", "Failed to query existing link");
  if (existing?.association_status === "active") {
    return jsonError(409, "conflict", "This kid is already linked to HitTrax. Disconnect first before creating a new account.");
  }

  // ---- 6. Build COPPA-aware account params --------------------------------
  const dob = kid.date_of_birth;
  if (!dob) return jsonError(400, "bad_request", "Kid must have a date of birth set before creating a HitTrax account");

  const age = ageFromDOB(dob);
  const guardianEmail = age < 13 ? parentEmail : undefined;
  const thirdPartyUserId = crypto.randomUUID();

  // ---- 7. Create the HitTrax account --------------------------------------
  let thirdPartyUserPassword: string;
  try {
    thirdPartyUserPassword = await createCloudUserAccount(cfg, {
      username: hittraxUsername,
      thirdPartyUsername: thirdPartyUserId,
      password,
      firstName: kid.first_name,
      lastName: kid.last_name,
      birthdate: isoToHitTraxDate(dob),
      email: parentEmail,
      guardianEmail,
      gender: gender as "male" | "female" | "other",
      sport: sport as "Baseball" | "Fastpitch Softball" | "Slowpitch Softball",
      skillLevel,
      position: position ?? kid.primary_position ?? undefined,
      bats: bats as "Right" | "Left" | "Switch" | undefined,
      throws: throws_ as "Right" | "Left" | undefined,
      heightInches,
    });
  } catch (err) {
    console.error("hittrax-create-account create failed", String(err));
    return hitTraxErrorResponse(err);
  }

  // ---- 8. Persist kid_capture_links row -----------------------------------
  // Link goes straight to 'active' — CreateCloudUserAccount pre-links the account.
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
      console.error("hittrax-create-account insert failed", insertErr);
      return jsonError(500, "db_error", "Failed to create link row");
    }
    linkId = inserted.id;
  }

  const coppaNote = guardianEmail ? ` (COPPA: guardian email sent to ${guardianEmail})` : "";
  console.log(`hittrax-create-account ok link=${linkId} user=${hittraxUsername} age=${age}${coppaNote} ms=${Date.now() - startedAt}`);

  return jsonOk({
    link_id: linkId,
    association_status: "active",
    hittrax_username: hittraxUsername,
  });
});
