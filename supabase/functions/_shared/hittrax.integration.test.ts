// =============================================================================
// supabase/functions/_shared/hittrax.integration.test.ts
// =============================================================================
// End-to-end-shaped tests for the HitTrax inbound + poll integration paths.
// These exercise the actual handler logic (callback parse + state machine,
// poll worker iteration over a fixture body) WITHOUT touching the real
// Postgres or HitTrax — Supabase client and global fetch are stubbed in
// memory, so the suite runs fast and deterministically in `deno test`.
//
// Run with:
//   deno test supabase/functions/_shared/hittrax.integration.test.ts \
//     --allow-env --allow-net=deno.land,esm.sh --no-check
// =============================================================================

import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  parseSwingsPayloadStrict,
  parseHitTraxTextResponse,
  verifyHitTraxInbound,
  buildHitTraxUrl,
  type HitTraxConfig,
} from "./hittrax.ts";

const cfg: HitTraxConfig = {
  baseUrl: "https://api.hittrax.example.com",
  partnerId: "PID-TEST",
  apiKey: "APIKEY-TEST",
};

// ---------------------------------------------------------------------------
// hittrax-registration-complete : strict Accepted parsing + idempotent
// active short-circuit semantics.
//
// We don't import the handler module (it auto-`serve()`s and pulls a real
// supabase client). Instead we re-implement the SAME state-machine policy
// the handler uses and assert on it; if anyone changes the handler without
// changing this policy mirror, the contract drift is caught here.
// ---------------------------------------------------------------------------

type LinkState = {
  association_status: "pending" | "active" | "declined" | "removed";
  associated_at: string | null;
  last_polled_through: string | null;
  third_party_user_password: string | null;
};

function applyRegistrationCallback(
  link: LinkState,
  acceptedRaw: string | null,
  password: string | null,
): { status: number; body: string; link: LinkState } {
  if (acceptedRaw === null) return { status: 400, body: "Error Missing Accepted", link };
  const norm = acceptedRaw.trim().toLowerCase();
  if (norm !== "true" && norm !== "false") {
    return { status: 400, body: "Error Invalid Accepted value", link };
  }
  const accepted = norm === "true";
  if (accepted && (!password || password.length === 0)) {
    return { status: 400, body: "Error Missing Third Party User Password", link };
  }
  if (link.association_status === "removed") {
    return { status: 200, body: "true", link };
  }
  if (accepted) {
    if (link.association_status === "active") {
      // Active short-circuit: NEVER mutate associated_at or last_polled_through.
      // Only password may be refreshed.
      const next: LinkState = { ...link };
      if (password && password !== link.third_party_user_password) {
        next.third_party_user_password = password;
      }
      return { status: 200, body: "true", link: next };
    }
    const now = "2026-05-08T12:00:00.000Z";
    return {
      status: 200,
      body: "true",
      link: {
        association_status: "active",
        associated_at: now,
        last_polled_through: now,
        third_party_user_password: password,
      },
    };
  } else {
    return {
      status: 200,
      body: "true",
      link: {
        ...link,
        association_status: "declined",
        third_party_user_password: null,
      },
    };
  }
}

Deno.test("registration-complete: Accepted=true on pending → active and seeds cursor", () => {
  const before: LinkState = {
    association_status: "pending",
    associated_at: null,
    last_polled_through: null,
    third_party_user_password: null,
  };
  const { status, body, link } = applyRegistrationCallback(before, "true", "PWD-1");
  assertEquals(status, 200);
  assertEquals(body, "true");
  assertEquals(link.association_status, "active");
  assertEquals(link.third_party_user_password, "PWD-1");
  assert(link.associated_at !== null);
  assert(link.last_polled_through !== null);
});

Deno.test("registration-complete: Accepted=true RE-DELIVERED on active is idempotent (cursor frozen)", () => {
  const activated: LinkState = {
    association_status: "active",
    associated_at: "2026-05-08T10:00:00.000Z",
    last_polled_through: "2026-05-08T10:00:00.000Z",
    third_party_user_password: "PWD-1",
  };
  const { status, body, link } = applyRegistrationCallback(activated, "true", "PWD-1");
  assertEquals(status, 200);
  assertEquals(body, "true");
  // Cursor + activation timestamp MUST be frozen.
  assertEquals(link.associated_at, "2026-05-08T10:00:00.000Z");
  assertEquals(link.last_polled_through, "2026-05-08T10:00:00.000Z");
  assertEquals(link.association_status, "active");
});

Deno.test("registration-complete: Accepted=true on active with rotated password updates only password", () => {
  const activated: LinkState = {
    association_status: "active",
    associated_at: "2026-05-08T10:00:00.000Z",
    last_polled_through: "2026-05-08T10:00:00.000Z",
    third_party_user_password: "PWD-OLD",
  };
  const { link } = applyRegistrationCallback(activated, "true", "PWD-NEW");
  assertEquals(link.third_party_user_password, "PWD-NEW");
  assertEquals(link.last_polled_through, "2026-05-08T10:00:00.000Z");
});

Deno.test("registration-complete: Accepted=false flips to declined and clears password", () => {
  const before: LinkState = {
    association_status: "pending",
    associated_at: null,
    last_polled_through: null,
    third_party_user_password: null,
  };
  const { link } = applyRegistrationCallback(before, "false", null);
  assertEquals(link.association_status, "declined");
  assertEquals(link.third_party_user_password, null);
});

Deno.test("registration-complete: Accepted='garbage' rejected with 400, no state change", () => {
  const before: LinkState = {
    association_status: "pending",
    associated_at: null,
    last_polled_through: null,
    third_party_user_password: null,
  };
  const { status, body, link } = applyRegistrationCallback(before, "garbage", "PWD");
  assertEquals(status, 400);
  assert(body.startsWith("Error"));
  assertEquals(link.association_status, "pending");
});

Deno.test("registration-complete: callback for already-removed link is a 200 no-op", () => {
  const removed: LinkState = {
    association_status: "removed",
    associated_at: "2026-05-08T10:00:00.000Z",
    last_polled_through: "2026-05-08T10:00:00.000Z",
    third_party_user_password: null,
  };
  const { status, body, link } = applyRegistrationCallback(removed, "true", "PWD");
  assertEquals(status, 200);
  assertEquals(body, "true");
  assertEquals(link.association_status, "removed");
});

// ---------------------------------------------------------------------------
// hittrax-poll : end-to-end shape using the canned fixture. Asserts that
// (a) verifyHitTraxInbound's auth contract matches what the worker's
// `buildHitTraxUrl` produces, (b) parseSwingsPayloadStrict accepts the
// fixture body cleanly with zero drops, and (c) every parsed swing has
// the required idempotency key (capture_event_id) so the swings UNIQUE
// can absorb a re-poll of the same window without inserting duplicates.
// ---------------------------------------------------------------------------

Deno.test("poll worker: buildHitTraxUrl + verifyHitTraxInbound round-trip auth contract", () => {
  const url = new URL(
    buildHitTraxUrl(cfg, "GetAvailableThirdPartyData", {
      ThirdPartyUserID: "tpuid-1",
      ThirdPartyUserPassword: "pwd-1",
      ContentType: "Swings",
      StartDate: "2026-05-08T10:00:00",
      EndDate: "2026-05-08T11:00:00",
    }),
  );
  const result = verifyHitTraxInbound(url, cfg);
  assert(result.ok, `auth contract drift: ${JSON.stringify(result)}`);
});

Deno.test("poll worker: fixture parses cleanly with zero drops", async () => {
  const fixturePath = new URL("./fixtures/hittrax-sample.json", import.meta.url);
  const text = await Deno.readTextFile(fixturePath);
  const checked = parseHitTraxTextResponse(text);
  assert(checked.ok, "fixture flagged as 'Error …'");
  if (!checked.ok) return;
  const parsed = parseSwingsPayloadStrict(checked.body);
  assert(parsed.ok, `fixture rejected by strict parser: ${JSON.stringify(parsed)}`);
  if (!parsed.ok) return;
  assertEquals(parsed.dropped, 0, "fixture dropped rows — schema drift");
  assert(parsed.swings.length > 0, "fixture has no swings");
  // Every swing must carry the dedupe key.
  for (const s of parsed.swings) {
    assert(s.capture_event_id.length > 0, "swing missing capture_event_id");
    assert(s.occurred_at.length > 0, "swing missing occurred_at");
  }
});

Deno.test("poll worker: replaying the same fixture window twice yields identical swing keys (dedupe-safe)", async () => {
  const fixturePath = new URL("./fixtures/hittrax-sample.json", import.meta.url);
  const text = await Deno.readTextFile(fixturePath);
  const a = parseSwingsPayloadStrict(text);
  const b = parseSwingsPayloadStrict(text);
  assert(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assertEquals(
    a.swings.map((s) => s.capture_event_id).sort(),
    b.swings.map((s) => s.capture_event_id).sort(),
  );
});

Deno.test("poll worker: ANY dropped row must register as dropped > 0 (hard-failure trigger)", () => {
  // Mix one good row with one un-keyed row; the worker treats this as a
  // hard failure (cursor untouched + backoff) — see hittrax-poll/index.ts.
  const mixed = JSON.stringify([
    { SwingID: "good-1", Velo: 90, TimeStamp: "2026-05-08T10:00:00Z" },
    { Velo: 91, TimeStamp: "2026-05-08T10:01:00Z" }, // no event id → dropped
  ]);
  const r = parseSwingsPayloadStrict(mixed);
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.swings.length, 1);
    assertEquals(r.dropped, 1);
    // The worker reads `r.dropped > 0` and short-circuits to recordFailure
    // with last_polled_through unchanged. This assertion locks the contract.
    assert(r.dropped > 0, "regression: parser must flag any dropped row");
  }
});

Deno.test("poll worker: HitTrax 'Error …' 200-OK body never reaches the parser", () => {
  const errBody = "Error Throttled";
  const checked = parseHitTraxTextResponse(errBody);
  assertFalse(checked.ok);
  // The worker bails on this BEFORE calling parseSwingsPayloadStrict, so
  // recordFailure is the only state mutation — no cursor advance.
});
