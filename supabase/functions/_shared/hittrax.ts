// =============================================================================
// supabase/functions/_shared/hittrax.ts
// =============================================================================
// Shared helpers for the HitTrax Edge Functions.
//
// HitTrax API v1.3 — Third Party / HitTrax Account Management and Data
// Retrieval API (Developers Guide v1.3, HitTrax, Northborough MA).
//
// ---- Outbound calls WE make TO HitTrax (all GET unless noted) ----
//   CheckForCloudUsernameEligibility      GET  → "true"|"false"
//   CreateCloudUserAccount                POST → ThirdPartyUserPassword
//   AuthenticateCloudUser                 GET  → session token
//   ProvideOTPResponseCode                GET  → session token
//   AuthenticateCloudUserViaThirdParty    GET  → session token
//   AssociateThirdPartyAccountWithCloudCredentials GET → ThirdPartyUserPassword
//   RemoveThirdPartyAssociationFromCloudUser       GET → "true"
//   RetrieveThirdPartyAccountFromLinkedCloudUser   GET → JSON
//   RetrieveCloudUserAccountFromLinkedThirdPartyAccount GET → JSON
//   NotifyKioskOfUserEvent                GET  → "true"
//   GetAvailableThirdPartyData            GET  → JSON
//   LogOutThirdPartyCloudUser             GET  → "true"
//
// ---- Inbound calls HitTrax makes TO US ----
//   ForgetHitTraxUser  POST  (GDPR purge)
//
// All responses on success are plain text.
// All error responses begin with "Error" followed by a reason string
// (see Appendix, p.20 of the spec).
//
// Auth model: PartnerID + APIKey in every query string. No Authorization
// header. Session tokens are short-lived (2h inactivity TTL) and must
// never be persisted — generate fresh per-request.
// =============================================================================

export type HitTraxConfig = {
  baseUrl: string;
  partnerId: string;
  apiKey: string;
};

export function readHitTraxConfig(): HitTraxConfig | null {
  const baseUrl = Deno.env.get("HITTRAX_BASE_URL");
  const partnerId = Deno.env.get("HITTRAX_PARTNER_ID");
  const apiKey = Deno.env.get("HITTRAX_API_KEY");
  if (!baseUrl || !partnerId || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), partnerId, apiKey };
}

// Constant-time string comparison — never use === on a secret value.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verify an inbound HitTrax callback (ForgetHitTraxUser) carries the
// PartnerID + APIKey issued to us.
export function verifyHitTraxInbound(
  url: URL,
  cfg: HitTraxConfig,
): { ok: true } | { ok: false; status: 401 | 400; code: string; message: string } {
  const partnerId = url.searchParams.get("PartnerID");
  const apiKey = url.searchParams.get("APIKey");
  if (!partnerId) return { ok: false, status: 400, code: "missing_partner_id", message: "Missing PartnerID" };
  if (!apiKey) return { ok: false, status: 400, code: "missing_api_key", message: "Missing APIKey" };
  if (!timingSafeEqual(partnerId, cfg.partnerId) || !timingSafeEqual(apiKey, cfg.apiKey)) {
    return { ok: false, status: 401, code: "invalid_partner_login", message: "Invalid Partner Login" };
  }
  return { ok: true };
}

// Build a HitTrax outbound URL. Uses URLSearchParams so values are always
// properly encoded and secrets never leak into the URL path.
export function buildHitTraxUrl(
  cfg: HitTraxConfig,
  endpoint: string,
  params: Record<string, string | number | undefined | null> = {},
): string {
  const url = new URL(`${cfg.baseUrl}/${endpoint}`);
  url.searchParams.set("PartnerID", cfg.partnerId);
  url.searchParams.set("APIKey", cfg.apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

// Format a Date for HitTrax StartDate/EndDate params.
// Spec format: YYYY-MM-DDTHH:MI:SS:SSS (colon before milliseconds).
export function formatHitTraxDate(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}:${pad(d.getUTCMilliseconds(), 3)}`
  );
}

// Parse a HitTrax plain-text response.
// Returns { ok: true, body } for normal values ("true", session token, password, etc.)
// Returns { ok: false, error } when HitTrax returned an "Error ..." string.
export type HitTraxResponse = { ok: true; body: string } | { ok: false; error: string };

export function parseHitTraxTextResponse(body: string): HitTraxResponse {
  const trimmed = body.trim();
  if (trimmed.toLowerCase().startsWith("error")) {
    return { ok: false, error: trimmed };
  }
  return { ok: true, body: trimmed };
}

// =============================================================================
// v1.3 HTTP helpers — one function per outbound endpoint.
// All throw a descriptive Error on failure so callers can catch + re-throw
// as structured edge-function errors.
// =============================================================================

const DEFAULT_TIMEOUT_MS = 15_000;

// Internal: GET a HitTrax URL and return the plain-text body.
// Throws on network error, timeout, or non-2xx HTTP status.
async function hitTraxGet(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === "AbortError") throw new Error("hittrax_timeout");
    throw new Error("hittrax_unreachable");
  }
  clearTimeout(timer);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("hitTraxGet non-2xx", { status: res.status, url, body: text.slice(0, 200) });
    throw new Error(`hittrax_http_${res.status}: ${text.slice(0, 200)}`);
  }
  return text;
}

// Internal: POST a HitTrax URL with a JSON body, return plain-text body.
async function hitTraxPost(url: string, bodyObj: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === "AbortError") throw new Error("hittrax_timeout");
    throw new Error("hittrax_unreachable");
  }
  clearTimeout(timer);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("hitTraxPost non-2xx", { status: res.status, url, body: text.slice(0, 200) });
    throw new Error(`hittrax_http_${res.status}: ${text.slice(0, 200)}`);
  }
  return text;
}

// ---------------------------------------------------------------------------
// AuthenticateCloudUser (v1.3 p.6)
// Authenticate with HitTrax username + password → session token.
// Throws on bad credentials ("HitTrax User Authentication Failure") or any
// other HitTrax error so the caller can surface a meaningful message.
// ---------------------------------------------------------------------------
export async function authenticateCloudUser(
  cfg: HitTraxConfig,
  username: string,
  password: string,
): Promise<string> {
  const url = buildHitTraxUrl(cfg, "AuthenticateCloudUser", {
    UserName: username,
    Password: password,
    UseOTP: "false",
  });
  const raw = await hitTraxGet(url);
  const parsed = parseHitTraxTextResponse(raw);
  if (!parsed.ok) {
    const lower = parsed.error.toLowerCase();
    if (lower.includes("authentication failure") || lower.includes("account not verified")) {
      throw new Error("invalid_hittrax_credentials: " + parsed.error);
    }
    throw new Error("hittrax_auth_error: " + parsed.error);
  }
  return parsed.body; // session token
}

// ---------------------------------------------------------------------------
// AuthenticateCloudUserViaThirdParty (v1.3 p.9)
// Authenticate using the ThirdPartyUserID + ThirdPartyUserPassword we stored
// at association time → session token. Used for disconnect and future re-auth.
// ---------------------------------------------------------------------------
export async function authenticateCloudUserViaThirdParty(
  cfg: HitTraxConfig,
  thirdPartyUserId: string,
  thirdPartyUserPassword: string,
): Promise<string> {
  const url = buildHitTraxUrl(cfg, "AuthenticateCloudUserViaThirdParty", {
    ThirdPartyUserID: thirdPartyUserId,
    ThirdPartyUserPassword: thirdPartyUserPassword,
  });
  const raw = await hitTraxGet(url);
  const parsed = parseHitTraxTextResponse(raw);
  if (!parsed.ok) throw new Error("hittrax_third_party_auth_error: " + parsed.error);
  return parsed.body; // session token
}

// ---------------------------------------------------------------------------
// AssociateThirdPartyAccountWithCloudCredentials (v1.3 p.10)
// Associate our ThirdPartyUserID with the authenticated session.
// Returns the ThirdPartyUserPassword — store it; it's the permanent credential
// for future API calls on behalf of this user.
// ---------------------------------------------------------------------------
export async function associateThirdPartyAccount(
  cfg: HitTraxConfig,
  sessionToken: string,
  thirdPartyUserId: string,
): Promise<string> {
  const url = buildHitTraxUrl(cfg, "AssociateThirdPartyAccountWithCloudCredentials", {
    UserSessionToken: sessionToken,
    ThirdPartyUserID: thirdPartyUserId,
  });
  const raw = await hitTraxGet(url);
  const parsed = parseHitTraxTextResponse(raw);
  if (!parsed.ok) throw new Error("hittrax_associate_error: " + parsed.error);
  return parsed.body; // ThirdPartyUserPassword
}

// ---------------------------------------------------------------------------
// RemoveThirdPartyAssociationFromCloudUser (v1.3 p.11)
// Terminates the association. Requires an active session token — call
// authenticateCloudUserViaThirdParty first.
// ---------------------------------------------------------------------------
export async function removeThirdPartyAssociation(
  cfg: HitTraxConfig,
  sessionToken: string,
): Promise<void> {
  const url = buildHitTraxUrl(cfg, "RemoveThirdPartyAssociationFromCloudUser", {
    UserSessionToken: sessionToken,
  });
  const raw = await hitTraxGet(url);
  const parsed = parseHitTraxTextResponse(raw);
  if (!parsed.ok) throw new Error("hittrax_remove_error: " + parsed.error);
}

// ---------------------------------------------------------------------------
// LogOutThirdPartyCloudUser (v1.3 p.17)
// Terminates the session. Best-effort — always call after associate/remove to
// avoid leaving dangling sessions on HitTrax servers.
// ---------------------------------------------------------------------------
export async function logOutSession(cfg: HitTraxConfig, sessionToken: string): Promise<void> {
  try {
    const url = buildHitTraxUrl(cfg, "LogOutThirdPartyCloudUser", { UserSessionToken: sessionToken });
    await hitTraxGet(url);
  } catch (err) {
    // Best-effort — log but never let a logout failure bubble up.
    console.warn("hittrax logOutSession failed (non-fatal)", err);
  }
}

// ---------------------------------------------------------------------------
// CheckForCloudUsernameEligibility (v1.3 p.3)
// Returns true if username is available, false if taken.
// ---------------------------------------------------------------------------
export async function checkCloudUsernameEligibility(
  cfg: HitTraxConfig,
  cloudUsername: string,
): Promise<boolean> {
  const url = buildHitTraxUrl(cfg, "CheckForCloudUsernameEligibility", { CloudUsername: cloudUsername });
  const raw = await hitTraxGet(url);
  const parsed = parseHitTraxTextResponse(raw);
  if (!parsed.ok) throw new Error("hittrax_username_check_error: " + parsed.error);
  return parsed.body.toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// CreateCloudUserAccount (v1.3 p.4)
// Creates a HitTrax Cloud account and automatically links it to our
// ThirdPartyUserID. Returns the ThirdPartyUserPassword — store it.
// ---------------------------------------------------------------------------
export type CreateHitTraxAccountParams = {
  username: string;
  thirdPartyUsername: string; // our internal identifier (e.g. kid's Supabase UUID as string)
  password: string;
  firstName: string;
  lastName: string;
  birthdate: string; // MM/DD/YYYY
  email: string;
  guardianEmail?: string; // required if user < 13
  cellPhone?: string;
  heightInches?: number;
  gender: "male" | "female" | "other";
  sport: "Baseball" | "Fastpitch Softball" | "Slowpitch Softball";
  skillLevel: string;
  position?: string;
  bats?: "Right" | "Left" | "Switch";
  throws?: "Right" | "Left";
};

export async function createCloudUserAccount(
  cfg: HitTraxConfig,
  params: CreateHitTraxAccountParams,
): Promise<string> {
  const url = buildHitTraxUrl(cfg, "CreateCloudUserAccount");
  const postBody = {
    Username: params.username,
    ThirdPartyUsername: params.thirdPartyUsername,
    Password: params.password,
    FirstName: params.firstName,
    LastName: params.lastName,
    Birthdate: params.birthdate,
    Email: params.email,
    ...(params.guardianEmail ? { GuardianEmailAddress: params.guardianEmail } : {}),
    ...(params.cellPhone ? { CellPhoneNumber: params.cellPhone } : {}),
    ...(params.heightInches !== undefined ? { Height: params.heightInches } : {}),
    Gender: params.gender,
    Sport: params.sport,
    SkillLevel: params.skillLevel,
    ...(params.position ? { Position: params.position } : {}),
    ...(params.bats ? { Bats: params.bats } : {}),
    ...(params.throws ? { Throws: params.throws } : {}),
  };
  const raw = await hitTraxPost(url, postBody);
  const parsed = parseHitTraxTextResponse(raw);
  if (!parsed.ok) {
    if (parsed.error.toLowerCase().includes("username already in use")) {
      throw new Error("hittrax_username_taken: " + parsed.error);
    }
    throw new Error("hittrax_create_account_error: " + parsed.error);
  }
  return parsed.body; // ThirdPartyUserPassword
}

// =============================================================================
// Swing payload parser (GetAvailableThirdPartyData)
// =============================================================================

export type ParsedSwing = {
  capture_event_id: string;
  capture_session_id: string | null;
  facility_id: string | null;
  occurred_at: string;
  exit_velocity_mph: number | null;
  launch_angle_deg: number | null;
  distance_ft: number | null;
  contact_quality: string | null;
  result: string | null;
  pitch_speed_mph: number | null;
  spray_angle_deg: number | null;
  raw: Record<string, unknown>;
};

const FIELD_MAP = {
  event_id:           ["SwingID", "EventID", "Id", "id"],
  session_id:         ["SessionID", "session_id"],
  facility_id:        ["FacilityID", "facility_id"],
  occurred_at:        ["TimeStamp", "Timestamp", "EventTime", "occurred_at", "Time"],
  exit_velocity_mph:  ["Velo", "ExitVelocity", "ExitVelo", "exit_velocity_mph", "EV"],
  launch_angle_deg:   ["LaunchAngle", "VertAngle", "launch_angle_deg", "LA"],
  distance_ft:        ["Distance", "distance_ft", "Dist"],
  contact_quality:    ["ContactQuality", "Quality", "contact_quality"],
  result:             ["Result", "AB", "result", "Outcome"],
  pitch_speed_mph:    ["PitchSpeed", "PitchVelo", "pitch_speed_mph"],
  spray_angle_deg:    ["SprayAngle", "HorzAngle", "spray_angle_deg"],
} as const;

function pickString(obj: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function parseSwingRow(raw: unknown): ParsedSwing | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const eventId = pickString(obj, FIELD_MAP.event_id);
  if (!eventId) return null;
  const occurredAtRaw = pickString(obj, FIELD_MAP.occurred_at);
  let occurred_at = occurredAtRaw ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(occurred_at))) occurred_at = new Date().toISOString();
  return {
    capture_event_id: eventId,
    capture_session_id: pickString(obj, FIELD_MAP.session_id),
    facility_id: pickString(obj, FIELD_MAP.facility_id),
    occurred_at: new Date(occurred_at).toISOString(),
    exit_velocity_mph: pickNumber(obj, FIELD_MAP.exit_velocity_mph),
    launch_angle_deg: pickNumber(obj, FIELD_MAP.launch_angle_deg),
    distance_ft: (() => {
      const n = pickNumber(obj, FIELD_MAP.distance_ft);
      return n === null ? null : Math.max(0, Math.round(n));
    })(),
    contact_quality: pickString(obj, FIELD_MAP.contact_quality),
    result: pickString(obj, FIELD_MAP.result),
    pitch_speed_mph: pickNumber(obj, FIELD_MAP.pitch_speed_mph),
    spray_angle_deg: pickNumber(obj, FIELD_MAP.spray_angle_deg),
    raw: obj,
  };
}

export function parseSwingsPayload(rawJson: string): ParsedSwing[] {
  const r = parseSwingsPayloadStrict(rawJson);
  return r.ok ? r.swings : [];
}

export type ParsedSwingsResult =
  | { ok: true; swings: ParsedSwing[]; dropped: number }
  | { ok: false; code: "invalid_json" | "unexpected_envelope"; sample: string };

export function parseSwingsPayloadStrict(rawJson: string): ParsedSwingsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, code: "invalid_json", sample: rawJson.slice(0, 200) };
  }
  let arr: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["Data", "Swings", "Records", "data", "swings", "records"]) {
      const v = obj[key];
      if (Array.isArray(v)) { arr = v; break; }
    }
  }
  if (arr === null) {
    const sample = (() => { try { return JSON.stringify(parsed).slice(0, 200); } catch { return "<unstringifiable>"; } })();
    return { ok: false, code: "unexpected_envelope", sample };
  }
  const swings: ParsedSwing[] = [];
  let dropped = 0;
  for (const row of arr) {
    const swing = parseSwingRow(row);
    if (swing) swings.push(swing); else dropped++;
  }
  return { ok: true, swings, dropped };
}

// =============================================================================
// Response helpers — shared shape across all functions
// =============================================================================

export function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Plain-text response for inbound HitTrax callbacks (ForgetHitTraxUser).
export function hittraxText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Map a thrown Error from a v1.3 helper to a structured jsonError response.
export function hitTraxErrorResponse(err: unknown): Response {
  const msg = (err instanceof Error ? err.message : String(err)) ?? "unknown";
  if (msg.startsWith("hittrax_timeout")) return jsonError(504, "hittrax_timeout", "HitTrax request timed out");
  if (msg.startsWith("hittrax_unreachable")) return jsonError(502, "hittrax_unreachable", "Could not reach HitTrax");
  if (msg.startsWith("invalid_hittrax_credentials")) {
    return jsonError(401, "invalid_hittrax_credentials", "Invalid HitTrax username or password. Please check your credentials and try again.");
  }
  if (msg.startsWith("hittrax_username_taken")) {
    return jsonError(409, "hittrax_username_taken", "That HitTrax username is already taken. Please choose a different one.");
  }
  // Surface the HitTrax error text after the colon so the app can show it.
  const detail = msg.includes(": ") ? msg.split(": ").slice(1).join(": ") : msg;
  return jsonError(502, "hittrax_error", detail);
}
