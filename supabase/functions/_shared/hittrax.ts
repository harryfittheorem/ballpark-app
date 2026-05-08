// =============================================================================
// supabase/functions/_shared/hittrax.ts
// =============================================================================
// Shared helpers for the HitTrax Edge Functions:
//   * Inbound auth (PartnerID + APIKey verification, constant-time)
//   * Outbound URL builder + response parser
//   * Swing-payload parser (placeholder schema — see TODO)
//
// HitTrax API conventions (per Third Party Data Sharing API v1.0):
//   * All credentials are passed as URL query parameters (PartnerID, APIKey,
//     ThirdPartyUserID, ThirdPartyUserPassword). No Authorization header.
//   * Successful responses are plain text:
//       - AssociateThirdPartyAccount   -> "true|false" (registration|release)
//       - CompleteHitTraxRegistration  -> "true"
//       - GetAvailableThirdPartyData   -> JSON string (content-type-dependent)
//       - RemoveThirdPartyAssociation  -> "true"
//       - ForgetHitTraxUser            -> "true"
//   * Error responses are plain text starting with "Error" + a detail string
//     drawn from the Appendix table on page 12 of the spec.
//
// HitTrax inbound auth model (CompleteHitTraxRegistration / ForgetHitTraxUser):
//   the spec instructs the third party to "validate that we are referring to
//   them with the same PartnerID and APIKey we provided at time of initial
//   setup." That is the entire authentication mechanism — there is no HMAC
//   signature, no OAuth, no mTLS. We MUST therefore:
//     * Compare BOTH values in constant time (timingSafeEqual below).
//     * Refuse the request if either is missing/wrong (401).
//     * Accept only HTTPS (Supabase Edge Functions are HTTPS-only — no extra
//       check needed).
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

// Constant-time string comparison. NEVER use === on a secret — early-out on
// the first differing byte leaks length/prefix to a timing attacker.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verify that an inbound HitTrax callback (CompleteHitTraxRegistration,
// ForgetHitTraxUser) carries the PartnerID + APIKey HitTrax issued to us.
// Returns { ok: true } or a structured error suitable for jsonError().
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

// Build a HitTrax outbound URL. Always uses URLSearchParams so we never
// double-encode and never leak un-escaped user input into the path.
export function buildHitTraxUrl(
  cfg: HitTraxConfig,
  endpoint: string,
  params: Record<string, string | number | undefined | null>,
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

// Format a Date for HitTrax StartDate/EndDate query params. Spec says
// YYYY-MM-DDTHH:MI:SS:SSS (note the colon before milliseconds). We pass it
// through URLSearchParams which handles URI-encoding for us.
export function formatHitTraxDate(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}:${pad(d.getUTCMilliseconds(), 3)}`
  );
}

// Parse a HitTrax plain-text response. Returns either { ok: true, body } when
// the response is a normal string (e.g. "true", "true|false") or
// { ok: false, error } when HitTrax returned an "Error ..." string.
export type HitTraxResponse = { ok: true; body: string } | { ok: false; error: string };

export function parseHitTraxTextResponse(body: string): HitTraxResponse {
  const trimmed = body.trim();
  if (trimmed.toLowerCase().startsWith("error")) {
    return { ok: false, error: trimmed };
  }
  return { ok: true, body: trimmed };
}

// Parse the registration|release booleans returned by AssociateThirdPartyAccount.
// Spec example: "true|false" — they have the license but have not approved sharing.
export function parseAssociateResponse(
  body: string,
): { registration: boolean; release: boolean } | null {
  const parts = body.split("|").map((s) => s.trim().toLowerCase());
  if (parts.length !== 2) return null;
  const reg = parts[0] === "true" ? true : parts[0] === "false" ? false : null;
  const rel = parts[1] === "true" ? true : parts[1] === "false" ? false : null;
  if (reg === null || rel === null) return null;
  return { registration: reg, release: rel };
}

// =============================================================================
// Swing payload parser
// =============================================================================
// HitTrax's GetAvailableThirdPartyData JSON schema is "content-type dependent"
// per the spec — the exact field names are not in the publicly-shared portion
// of the v1.0 docs (pages 1-5). The shape below mirrors the headline metrics
// HitTrax surfaces in their own dashboard and is the schema our fixture file
// uses. When we receive the contracted ContentType definition from HitTrax
// (or have an actual response in hand), update FIELD_MAP accordingly — every
// parser caller goes through this one function.
//
// Defensive choices:
//   * Unknown / missing fields are silently dropped (left null). We never
//     throw on a partial payload — a swing with only exit_velocity is still
//     more useful than no swing.
//   * Numeric fields are coerced via Number() and Number.isFinite-checked.
//   * occurred_at parsing falls back to created_at / now() so a malformed
//     timestamp does not drop the swing entirely.
//   * The full JSON object is preserved on swings.raw for re-parsing later
//     once the canonical schema is confirmed.
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
  // Possible HitTrax field name variants we accept. First non-null wins.
  // TODO(hittrax-pages-6-12): tighten to the canonical names once the
  // contracted ContentType schema is confirmed. Until then we accept the
  // common variants that show up in the HitTrax web dashboard exports.
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
  if (!eventId) return null; // can't dedupe without an event id — drop.

  const occurredAtRaw = pickString(obj, FIELD_MAP.occurred_at);
  let occurred_at = occurredAtRaw ?? new Date().toISOString();
  // Validate parseability — if HitTrax sent us a malformed string, fall back.
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

// Parse the full GetAvailableThirdPartyData response. Accepts either:
//   * A bare array of swing objects: [ {...}, {...} ]
//   * An object with a `Data` / `Swings` / `Records` array property.
// Anything else returns an empty array.
export function parseSwingsPayload(rawJson: string): ParsedSwing[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return [];
  }
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["Data", "Swings", "Records", "data", "swings", "records"]) {
      const v = obj[key];
      if (Array.isArray(v)) {
        arr = v;
        break;
      }
    }
  }
  const out: ParsedSwing[] = [];
  for (const row of arr) {
    const swing = parseSwingRow(row);
    if (swing) out.push(swing);
  }
  return out;
}

// =============================================================================
// jsonError / jsonOk (small enough to repeat-locally vs sharing — but
// keeping them here keeps every function's response shape identical).
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

// HitTrax expects plain-text "true" / "Error <reason>" responses on the two
// endpoints WE host (CompleteHitTraxRegistration, ForgetHitTraxUser). Any
// other shape would either cause HitTrax to retry forever or to silently
// drop the user's response.
export function hittraxText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
