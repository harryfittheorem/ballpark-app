/**
 * Deno integration tests for the HitTrax shared helpers.
 *
 * Run from the project root:
 *   deno test --allow-env supabase/functions/_shared/hittrax.test.ts
 *
 * Covers the contracts the forget, poll, and inbound Edge Functions depend on:
 *   - timingSafeEqual: constant-time string compare; rejects mismatch /
 *     length difference / mid-string flips.
 *   - verifyHitTraxInbound: rejects mismatched PartnerID and APIKey, and
 *     400s on missing params, before any downstream work happens.
 *   - parseHitTraxTextResponse: routes "Error ..." to {ok:false}.
 *   - parseSwingsPayload: maps every accepted field-name variant to the
 *     canonical column, handles top-level array and {Data:[...]} envelopes,
 *     drops rows with no usable event id, and preserves raw payload.
 *
 * Note: parseAssociateResponse was removed in v1.3 — the new
 * AssociateThirdPartyAccountWithCloudCredentials endpoint returns a plain
 * ThirdPartyUserPassword string, not a "bool|bool" pair.
 */

import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  parseHitTraxTextResponse,
  parseSwingsPayload,
  parseSwingsPayloadStrict,
  timingSafeEqual,
  verifyHitTraxInbound,
  type HitTraxConfig,
} from "./hittrax.ts";

const cfg: HitTraxConfig = { baseUrl: "https://example.com", partnerId: "p1", apiKey: "k1" };

// ---------------------------------------------------------------------------
// timingSafeEqual
// ---------------------------------------------------------------------------
Deno.test("timingSafeEqual: equal strings", () => {
  assert(timingSafeEqual("ballpark", "ballpark"));
});

Deno.test("timingSafeEqual: case difference (still constant-time)", () => {
  assertFalse(timingSafeEqual("ballpark", "BALLPARK"));
});

Deno.test("timingSafeEqual: different lengths short-circuit", () => {
  assertFalse(timingSafeEqual("ballpark", "ballparks"));
});

Deno.test("timingSafeEqual: empty strings are equal", () => {
  assert(timingSafeEqual("", ""));
});

Deno.test("timingSafeEqual: late-byte flip", () => {
  assertFalse(timingSafeEqual("ballpark1234567X", "ballpark1234567Y"));
});

// ---------------------------------------------------------------------------
// verifyHitTraxInbound
// ---------------------------------------------------------------------------
Deno.test("verifyHitTraxInbound: matching PartnerID + APIKey", () => {
  const url = new URL("https://example.com/x?PartnerID=p1&APIKey=k1");
  const r = verifyHitTraxInbound(url, cfg);
  assert(r.ok);
});

Deno.test("verifyHitTraxInbound: wrong APIKey -> 401 invalid_partner_login", () => {
  const url = new URL("https://example.com/x?PartnerID=p1&APIKey=BAD");
  const r = verifyHitTraxInbound(url, cfg);
  assertFalse(r.ok);
  if (!r.ok) {
    assertEquals(r.status, 401);
    assertEquals(r.code, "invalid_partner_login");
  }
});

Deno.test("verifyHitTraxInbound: wrong PartnerID -> 401 invalid_partner_login", () => {
  const url = new URL("https://example.com/x?PartnerID=BAD&APIKey=k1");
  const r = verifyHitTraxInbound(url, cfg);
  assertFalse(r.ok);
  if (!r.ok) {
    assertEquals(r.status, 401);
    assertEquals(r.code, "invalid_partner_login");
  }
});

Deno.test("verifyHitTraxInbound: missing PartnerID -> 400 missing_partner_id", () => {
  const url = new URL("https://example.com/x?APIKey=k1");
  const r = verifyHitTraxInbound(url, cfg);
  assertFalse(r.ok);
  if (!r.ok) assertEquals(r.code, "missing_partner_id");
});

Deno.test("verifyHitTraxInbound: missing APIKey -> 400 missing_api_key", () => {
  const url = new URL("https://example.com/x?PartnerID=p1");
  const r = verifyHitTraxInbound(url, cfg);
  assertFalse(r.ok);
  if (!r.ok) assertEquals(r.code, "missing_api_key");
});

// ---------------------------------------------------------------------------
// parseHitTraxTextResponse
// ---------------------------------------------------------------------------
Deno.test("parseHitTraxTextResponse: routes Error strings to {ok:false}", () => {
  const r = parseHitTraxTextResponse("Error Invalid Partner Login");
  assertFalse(r.ok);
  if (!r.ok) assertEquals(r.error, "Error Invalid Partner Login");
});

Deno.test("parseHitTraxTextResponse: trims OK strings", () => {
  const r = parseHitTraxTextResponse("  true  ");
  assert(r.ok);
  if (r.ok) assertEquals(r.body, "true");
});

// ---------------------------------------------------------------------------
// parseSwingsPayload — accepts JSON string in both array and {Data:[...]} forms.
// ---------------------------------------------------------------------------
Deno.test("parseSwingsPayload: bare array, canonical Velo/Distance/PitchSpeed names", () => {
  const swings = parseSwingsPayload(JSON.stringify([
    {
      SwingID: "evt-1",
      TimeStamp: "2026-05-08T12:00:00Z",
      Velo: 91.2,
      Distance: 340,
      PitchSpeed: 71,
      LaunchAngle: 18,
    },
  ]));
  assertEquals(swings.length, 1);
  assertEquals(swings[0].capture_event_id, "evt-1");
  assertEquals(swings[0].exit_velocity_mph, 91.2);
  assertEquals(swings[0].distance_ft, 340);
  assertEquals(swings[0].pitch_speed_mph, 71);
  assertEquals(swings[0].launch_angle_deg, 18);
});

Deno.test("parseSwingsPayload: {Data:[...]} envelope + abbreviation aliases (EV/Dist)", () => {
  const swings = parseSwingsPayload(JSON.stringify({
    Data: [{ SwingID: "evt-2", TimeStamp: "2026-05-08T12:01:00Z", EV: 88, Dist: 305.7 }],
  }));
  assertEquals(swings.length, 1);
  assertEquals(swings[0].exit_velocity_mph, 88);
  // distance_ft is rounded to int + non-negative.
  assertEquals(swings[0].distance_ft, 306);
});

Deno.test("parseSwingsPayload: drops rows without an event id", () => {
  const swings = parseSwingsPayload(JSON.stringify([
    { TimeStamp: "2026-05-08T12:00:00Z", Velo: 90 },
    { SwingID: "ok", TimeStamp: "2026-05-08T12:00:01Z", Velo: 91 },
  ]));
  assertEquals(swings.length, 1);
  assertEquals(swings[0].capture_event_id, "ok");
});

Deno.test("parseSwingsPayload: preserves raw payload verbatim for re-parse", () => {
  const raw = { SwingID: "evt-3", TimeStamp: "2026-05-08T12:00:00Z", Velo: 90, FooFutureField: "x" };
  const [s] = parseSwingsPayload(JSON.stringify([raw]));
  assertEquals(s.raw, raw);
});

Deno.test("parseSwingsPayload: groups by SessionID into capture_session_id", () => {
  const swings = parseSwingsPayload(JSON.stringify([
    { SwingID: "a", SessionID: "sess-1", TimeStamp: "2026-05-08T12:00:00Z", Velo: 90 },
    { SwingID: "b", SessionID: "sess-1", TimeStamp: "2026-05-08T12:00:01Z", Velo: 91 },
  ]));
  assertEquals(swings.length, 2);
  assertEquals(swings[0].capture_session_id, "sess-1");
  assertEquals(swings[1].capture_session_id, "sess-1");
});

Deno.test("parseSwingsPayload: malformed JSON returns empty array (never throws)", () => {
  assertEquals(parseSwingsPayload("{not json"), []);
});

Deno.test("parseSwingsPayload: empty array returns empty array", () => {
  assertEquals(parseSwingsPayload("[]"), []);
});

Deno.test("parseSwingsPayload: malformed TimeStamp falls back rather than dropping the row", () => {
  const swings = parseSwingsPayload(JSON.stringify([
    { SwingID: "evt-malformed-ts", TimeStamp: "not-a-date", Velo: 90 },
  ]));
  assertEquals(swings.length, 1);
  // occurred_at is set to a parseable ISO string from Date.now() fallback.
  assert(!Number.isNaN(Date.parse(swings[0].occurred_at)));
});

// ---------------------------------------------------------------------------
// parseSwingsPayloadStrict — fail-loud variant used by the poll worker so a
// malformed 200 body is never silently confused with "empty window".
// ---------------------------------------------------------------------------
Deno.test("parseSwingsPayloadStrict: legitimate empty window -> ok with 0 swings", () => {
  const r = parseSwingsPayloadStrict("[]");
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.swings.length, 0);
    assertEquals(r.dropped, 0);
  }
});

Deno.test("parseSwingsPayloadStrict: legitimate empty Data envelope -> ok", () => {
  const r = parseSwingsPayloadStrict(JSON.stringify({ Data: [] }));
  assert(r.ok);
  if (r.ok) assertEquals(r.swings.length, 0);
});

Deno.test("parseSwingsPayloadStrict: malformed JSON -> invalid_json with sample", () => {
  const r = parseSwingsPayloadStrict("<html>503 Service Unavailable</html>");
  assertFalse(r.ok);
  if (!r.ok) {
    assertEquals(r.code, "invalid_json");
    assert(r.sample.includes("503"));
  }
});

Deno.test("parseSwingsPayloadStrict: object without recognised swings array -> unexpected_envelope", () => {
  const r = parseSwingsPayloadStrict(JSON.stringify({ status: "ok", message: "no data" }));
  assertFalse(r.ok);
  if (!r.ok) assertEquals(r.code, "unexpected_envelope");
});

Deno.test("parseSwingsPayloadStrict: counts dropped rows separately from kept", () => {
  const r = parseSwingsPayloadStrict(JSON.stringify([
    { SwingID: "ok-1", Velo: 90 },
    { TimeStamp: "no event id", Velo: 91 },  // dropped: no event id
    { SwingID: "ok-2", Velo: 92 },
  ]));
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.swings.length, 2);
    assertEquals(r.dropped, 1);
  }
});

Deno.test("parseSwingsPayloadStrict: top-level null -> unexpected_envelope (not ok-with-zero)", () => {
  const r = parseSwingsPayloadStrict("null");
  assertFalse(r.ok);
  if (!r.ok) assertEquals(r.code, "unexpected_envelope");
});
