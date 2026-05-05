// =============================================================================
// supabase/functions/mux-webhook/index.ts
// =============================================================================
// v0.4 Step 4.5 — Mux outbound webhook receiver.
//
// Auth model: there is NO Supabase JWT on this endpoint. Authentication is
// the Mux signature on the raw request body, verified against
// MUX_WEBHOOK_SECRET. Deploy with:
//   npx supabase functions deploy mux-webhook --no-verify-jwt
//
// Required Edge Function secrets:
//   SUPABASE_URL                 (auto-injected by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-injected by Supabase)
//   MUX_WEBHOOK_SECRET           (operator: copy from Mux Dashboard ->
//                                 Settings -> Webhooks when registering
//                                 this endpoint, then
//                                 `npx supabase secrets set MUX_WEBHOOK_SECRET=...`)
//
// Trust boundary: the request body MUST be read as raw bytes (text), not
// parsed, for signature verification. We HMAC-SHA256 over `${t}.${rawBody}`
// and compare in constant time, then JSON.parse only after the signature
// passes. A tampered body changes the HMAC; a replayed body older than the
// tolerance window is rejected by the timestamp check.
//
// Idempotency: every event update is keyed on a UNIQUE column
// (mux_asset_id), and every UPDATE is shape-guarded with WHERE clauses so
// replays become no-ops. The function never inserts new rows on this path.
//
// Failure model:
//   - 200 {ok:true}                          event applied (or replay no-op)
//   - 200 {ok:true, ignored:true, reason}    unhandled event type (so Mux
//                                            stops retrying)
//   - 400 {error:{code,message}}             malformed JSON / missing or
//                                            malformed Mux-Signature header
//   - 401 {error:{code,message}}             bad signature or stale timestamp
//   - 503 {error:{code,message}}             event references an asset/upload
//                                            id we have no videos row for —
//                                            Mux exponentially backs off and
//                                            re-delivers (24h cap)
//
// Handled events:
//   video.upload.asset_created  upload id -> real asset id, status=processing
//   video.asset.ready           status=ready, mux_playback_id, duration_seconds
//   video.asset.errored         status=errored
//
// Race handling for `video.asset.ready` arriving before
// `video.upload.asset_created` (Mux delivery is at-least-once and unordered):
// fall back to looking up the row by the original upload id stored as
// mux_asset_id (data.upload_id on the ready event), and in one statement
// SET mux_asset_id = data.id AND populate playback / duration / status='ready'.
// This collapses both events into a single idempotent write.
//
// All DB writes use the service-role client (no JWT, no tenant pin
// available). Cross-tenant smuggling is prevented because every UPDATE
// keys on mux_asset_id, which is UNIQUE across the whole videos table —
// a forged event with a known asset id of tenant A cannot mutate tenant
// B's rows. Signature verification (which requires MUX_WEBHOOK_SECRET)
// gates the entire path.
//
// Logging: one line per request,
//   mux-webhook event=<type> asset_or_upload=<id> outcome=<...> ms=<n>
// No event payloads in logs (PII / private playback ids).
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MUX_WEBHOOK_SECRET = Deno.env.get("MUX_WEBHOOK_SECRET")!;

const TOLERANCE_SECONDS = 300; // 5 min replay window — Stripe convention.

type ErrorCode =
  | "method_not_allowed"
  | "missing_signature_header"
  | "malformed_signature_header"
  | "bad_timestamp"
  | "stale_timestamp"
  | "bad_signature"
  | "malformed_json"
  | "row_not_found"
  | "row_not_ready"
  | "db_error";

type Outcome =
  | "applied"
  | "noop"
  | "ignored"
  | "row_not_found"
  | "row_not_ready"
  | "bad_sig"
  | "stale"
  | "bad_request"
  | "db_error"
  | "method_not_allowed";

function jsonError(status: number, code: ErrorCode, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function logLine(eventType: string, idOrUpload: string, outcome: Outcome, ms: number): void {
  console.log(
    `mux-webhook event=${eventType || "-"} asset_or_upload=${idOrUpload || "-"} outcome=${outcome} ms=${ms}`,
  );
}

// Verify Mux's `Mux-Signature: t=<unix-seconds>,v1=<hex-hmac>` header
// against the raw body using HMAC-SHA256 over `${t}.${rawBody}`. Constant-
// time compare on the hex strings.
async function verifyMuxSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds: number,
): Promise<{ ok: true } | { ok: false; status: 400 | 401; reason: ErrorCode }> {
  if (!header) return { ok: false, status: 400, reason: "missing_signature_header" };

  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const [k, v] = kv.trim().split("=");
    if (k && v !== undefined) parts[k] = v;
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return { ok: false, status: 400, reason: "malformed_signature_header" };
  const tNum = Number(t);
  if (!Number.isFinite(tNum)) return { ok: false, status: 400, reason: "bad_timestamp" };
  if (Math.abs(Date.now() / 1000 - tNum) > toleranceSeconds) {
    return { ok: false, status: 401, reason: "stale_timestamp" };
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const macBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`)),
  );
  const expected = Array.from(macBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== v1.length) {
    return { ok: false, status: 401, reason: "bad_signature" };
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0 ? { ok: true } : { ok: false, status: 401, reason: "bad_signature" };
}

// Pick the public playback id from a Mux asset.ready payload. Step 4.4 mints
// uploads with new_asset_settings.playback_policy: ["public"], so there is
// always exactly one public id once Mux finishes processing.
function pickPublicPlaybackId(
  playbackIds: Array<{ id?: string; policy?: string }> | undefined,
): string | null {
  if (!Array.isArray(playbackIds)) return null;
  for (const p of playbackIds) {
    if (p && p.policy === "public" && typeof p.id === "string" && p.id.length > 0) {
      return p.id;
    }
  }
  return null;
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  const startedAt = Date.now();

  if (req.method !== "POST") {
    logLine("-", "-", "method_not_allowed", Date.now() - startedAt);
    return jsonError(405, "method_not_allowed", "POST required");
  }

  // ---- 1. Read raw body (required for signature verification) ------------
  const rawBody = await req.text();

  // ---- 2. Verify Mux signature -------------------------------------------
  const sigHeader =
    req.headers.get("Mux-Signature") ?? req.headers.get("mux-signature");
  const sig = await verifyMuxSignature(
    rawBody,
    sigHeader,
    MUX_WEBHOOK_SECRET,
    TOLERANCE_SECONDS,
  );
  if (!sig.ok) {
    const outcome: Outcome =
      sig.reason === "stale_timestamp"
        ? "stale"
        : sig.reason === "bad_signature"
          ? "bad_sig"
          : "bad_request";
    logLine("-", "-", outcome, Date.now() - startedAt);
    return jsonError(sig.status, sig.reason, sig.reason);
  }

  // ---- 3. Parse JSON (only after signature has passed) -------------------
  let event: {
    type?: string;
    data?: {
      id?: string;
      asset_id?: string;
      upload_id?: string;
      duration?: number;
      playback_ids?: Array<{ id?: string; policy?: string }>;
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    logLine("-", "-", "bad_request", Date.now() - startedAt);
    return jsonError(400, "malformed_json", "Body is not valid JSON");
  }

  const eventType = typeof event.type === "string" ? event.type : "";
  const data = event.data ?? {};
  const dataId = typeof data.id === "string" ? data.id : "";

  // ---- 4. Dispatch by event type -----------------------------------------
  try {
    switch (eventType) {
      // -------------------------------------------------------------------
      // upload.asset_created: Mux has accepted the bytes. data.id is the
      // upload id (which we stored in mux_asset_id at create time);
      // data.asset_id is the freshly-allocated real asset id.
      // -------------------------------------------------------------------
      case "video.upload.asset_created": {
        const newAssetId =
          typeof data.asset_id === "string" ? data.asset_id : "";
        if (!dataId || !newAssetId) {
          logLine(eventType, dataId, "bad_request", Date.now() - startedAt);
          return jsonError(400, "malformed_json", "Missing data.id or data.asset_id");
        }

        // Try the canonical path first: row keyed on the upload id, still
        // in 'uploading'. The WHERE guard makes a replay a no-op (returns 0
        // rows because status is no longer 'uploading').
        const { data: applied, error: applyErr } = await adminClient
          .from("videos")
          .update({ mux_asset_id: newAssetId, status: "processing" })
          .eq("mux_asset_id", dataId)
          .eq("status", "uploading")
          .select("id")
          .maybeSingle();

        if (applyErr) {
          logLine(eventType, dataId, "db_error", Date.now() - startedAt);
          return jsonError(500, "db_error", "Failed to update video row");
        }
        if (applied) {
          logLine(eventType, dataId, "applied", Date.now() - startedAt);
          return jsonOk({ ok: true });
        }

        // No row updated. Either (a) replay after we already swapped to the
        // asset id, or (b) ready already arrived first and collapsed both
        // events. Both are no-ops if a row exists keyed on the new asset id.
        const { data: alreadyDone, error: alreadyErr } = await adminClient
          .from("videos")
          .select("id")
          .eq("mux_asset_id", newAssetId)
          .maybeSingle();

        if (alreadyErr) {
          logLine(eventType, dataId, "db_error", Date.now() - startedAt);
          return jsonError(500, "db_error", "Failed to query video row");
        }
        if (alreadyDone) {
          logLine(eventType, dataId, "noop", Date.now() - startedAt);
          return jsonOk({ ok: true });
        }

        // Truly no row for this upload id. Per Race #1 in the plan this
        // shouldn't happen because Step 4.4 inserts before returning the
        // upload URL — but we 503 so Mux retries with backoff. (Per the
        // "always 503 row_not_found" decision in the plan.)
        logLine(eventType, dataId, "row_not_found", Date.now() - startedAt);
        return jsonError(503, "row_not_found", "No video row for this upload id");
      }

      // -------------------------------------------------------------------
      // asset.ready: Mux finished processing. data.id is the asset id,
      // data.upload_id is the original direct-upload id (used for the
      // race fallback below), data.playback_ids[] contains the public
      // playback id, data.duration is float seconds.
      // -------------------------------------------------------------------
      case "video.asset.ready": {
        if (!dataId) {
          logLine(eventType, dataId, "bad_request", Date.now() - startedAt);
          return jsonError(400, "malformed_json", "Missing data.id");
        }
        const playbackId = pickPublicPlaybackId(data.playback_ids);
        if (!playbackId) {
          // Mux always sends a public playback id for assets created with
          // playback_policy: ["public"]; treat absence as transient.
          logLine(eventType, dataId, "row_not_ready", Date.now() - startedAt);
          return jsonError(503, "row_not_ready", "No public playback_id on event");
        }
        const durationSeconds =
          typeof data.duration === "number" && Number.isFinite(data.duration)
            ? Math.max(0, Math.round(data.duration))
            : null;

        // Path A: row already keyed on the real asset id (normal case —
        // upload.asset_created arrived first).
        const updateA = await adminClient
          .from("videos")
          .update({
            mux_playback_id: playbackId,
            duration_seconds: durationSeconds,
            status: "ready",
          })
          .eq("mux_asset_id", dataId)
          .neq("status", "errored")
          .select("id")
          .maybeSingle();

        if (updateA.error) {
          logLine(eventType, dataId, "db_error", Date.now() - startedAt);
          return jsonError(500, "db_error", "Failed to update video row");
        }
        if (updateA.data) {
          logLine(eventType, dataId, "applied", Date.now() - startedAt);
          return jsonOk({ ok: true });
        }

        // Path B: ready arrived BEFORE upload.asset_created (Race #2). The
        // row is still keyed on the upload id. Collapse both events into
        // one statement: swap to the asset id AND populate ready fields.
        const uploadId =
          typeof data.upload_id === "string" ? data.upload_id : "";
        if (uploadId) {
          const updateB = await adminClient
            .from("videos")
            .update({
              mux_asset_id: dataId,
              mux_playback_id: playbackId,
              duration_seconds: durationSeconds,
              status: "ready",
            })
            .eq("mux_asset_id", uploadId)
            .neq("status", "errored")
            .select("id")
            .maybeSingle();
          if (updateB.error) {
            logLine(eventType, dataId, "db_error", Date.now() - startedAt);
            return jsonError(500, "db_error", "Failed to update video row");
          }
          if (updateB.data) {
            logLine(eventType, dataId, "applied", Date.now() - startedAt);
            return jsonOk({ ok: true });
          }
        }

        // Path C (idempotency): replay where we already set everything.
        // The neq('status','errored') guard above filters out an already-
        // ready row that would otherwise be re-written; check explicitly
        // so we return ok instead of 503 in that case.
        const { data: existing, error: existingErr } = await adminClient
          .from("videos")
          .select("id, status, mux_playback_id")
          .eq("mux_asset_id", dataId)
          .maybeSingle();
        if (existingErr) {
          logLine(eventType, dataId, "db_error", Date.now() - startedAt);
          return jsonError(500, "db_error", "Failed to query video row");
        }
        if (existing && existing.mux_playback_id === playbackId) {
          logLine(eventType, dataId, "noop", Date.now() - startedAt);
          return jsonOk({ ok: true });
        }
        if (existing && existing.status === "errored") {
          // We already marked this asset errored; refuse to flip it back.
          logLine(eventType, dataId, "noop", Date.now() - startedAt);
          return jsonOk({ ok: true });
        }

        logLine(eventType, dataId, "row_not_found", Date.now() - startedAt);
        return jsonError(503, "row_not_found", "No video row for this asset id");
      }

      // -------------------------------------------------------------------
      // asset.errored: Mux failed to process. data.id is the asset id;
      // we may also receive this before upload.asset_created landed, so
      // try the upload_id fallback too.
      // -------------------------------------------------------------------
      case "video.asset.errored": {
        if (!dataId) {
          logLine(eventType, dataId, "bad_request", Date.now() - startedAt);
          return jsonError(400, "malformed_json", "Missing data.id");
        }

        const updateA = await adminClient
          .from("videos")
          .update({ status: "errored" })
          .eq("mux_asset_id", dataId)
          .neq("status", "errored")
          .select("id")
          .maybeSingle();
        if (updateA.error) {
          logLine(eventType, dataId, "db_error", Date.now() - startedAt);
          return jsonError(500, "db_error", "Failed to update video row");
        }
        if (updateA.data) {
          logLine(eventType, dataId, "applied", Date.now() - startedAt);
          return jsonOk({ ok: true });
        }

        const uploadId =
          typeof data.upload_id === "string" ? data.upload_id : "";
        if (uploadId) {
          const updateB = await adminClient
            .from("videos")
            .update({ mux_asset_id: dataId, status: "errored" })
            .eq("mux_asset_id", uploadId)
            .neq("status", "errored")
            .select("id")
            .maybeSingle();
          if (updateB.error) {
            logLine(eventType, dataId, "db_error", Date.now() - startedAt);
            return jsonError(500, "db_error", "Failed to update video row");
          }
          if (updateB.data) {
            logLine(eventType, dataId, "applied", Date.now() - startedAt);
            return jsonOk({ ok: true });
          }
        }

        // Idempotent replay (already errored) -> noop ok.
        const { data: existing, error: existingErr } = await adminClient
          .from("videos")
          .select("id, status")
          .eq("mux_asset_id", dataId)
          .maybeSingle();
        if (existingErr) {
          logLine(eventType, dataId, "db_error", Date.now() - startedAt);
          return jsonError(500, "db_error", "Failed to query video row");
        }
        if (existing && existing.status === "errored") {
          logLine(eventType, dataId, "noop", Date.now() - startedAt);
          return jsonOk({ ok: true });
        }

        logLine(eventType, dataId, "row_not_found", Date.now() - startedAt);
        return jsonError(503, "row_not_found", "No video row for this asset id");
      }

      // -------------------------------------------------------------------
      // Anything else: ack 200 so Mux stops retrying. Returning a non-2xx
      // here would make every unhandled event type retry forever.
      // -------------------------------------------------------------------
      default: {
        logLine(eventType, dataId, "ignored", Date.now() - startedAt);
        return jsonOk({ ok: true, ignored: true, reason: "unhandled_event_type" });
      }
    }
  } catch (err) {
    console.error("mux-webhook unexpected error", err);
    logLine(eventType, dataId, "db_error", Date.now() - startedAt);
    return jsonError(500, "db_error", "Unexpected error handling event");
  }
});
