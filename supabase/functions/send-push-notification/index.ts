// =============================================================================
// supabase/functions/send-push-notification/index.ts
// =============================================================================
// v0.7 (task #93) — generic Expo push fan-out.
//
// Contract (POST):
//   Headers:
//     Authorization: Bearer <SERVICE_ROLE_KEY>   required
//   Body (JSON):
//     {
//       user_ids: string[],
//       title:    string,
//       body:     string,
//       data?:    Record<string, unknown>
//     }
//   Response 200: { ok: true, tokens: number, batches: number, ok_count: number, err_count: number }
//   Errors:       { error: { code, message } }
//                   401 unauthorized
//                   400 bad_request
//                   500 db_error
//                   502 expo_error / expo_unreachable / expo_bad_response
//                   504 expo_timeout
//
// Auth model:
//   This function is service-role only. It never sees a user JWT. It is
//   deployed with the default JWT verification ON; callers (other Edge
//   Functions or operator scripts) must pass the service-role key in the
//   Authorization header. Never expose to the app.
//
// Failure model:
//   - Returns a structured error on misconfiguration / Expo unreachable.
//   - For partial Expo failures (e.g. one ticket out of N is an error),
//     logs and still returns 200 with err_count > 0 — the caller never
//     throws because of a single bad token.
//   - Receipt-handling / pruning is out of scope for this task; we only
//     send the push and log tickets.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TIMEOUT_MS = 10_000;
const EXPO_BATCH_SIZE = 100; // Expo's documented per-request maximum.

type ErrorCode =
  | "method_not_allowed"
  | "unauthorized"
  | "bad_request"
  | "db_error"
  | "expo_error"
  | "expo_unreachable"
  | "expo_bad_response"
  | "expo_timeout";

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  const startedAt = Date.now();

  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed", "POST required");
  }

  // ---- 1. Service-role auth check ----------------------------------------
  // We don't decode the JWT here — equality with the configured service-role
  // key is enough, and matches the calling convention used by the other
  // Edge Functions when invoking each other.
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(401, "unauthorized", "Service role required");
  }

  // ---- 2. Parse body ------------------------------------------------------
  let body: {
    user_ids?: unknown;
    title?: unknown;
    body?: unknown;
    data?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Body is not valid JSON");
  }

  const userIds = Array.isArray(body.user_ids)
    ? body.user_ids.filter((x): x is string => typeof x === "string")
    : [];
  const title = typeof body.title === "string" ? body.title : "";
  const msgBody = typeof body.body === "string" ? body.body : "";
  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : undefined;

  if (userIds.length === 0) {
    return jsonError(400, "bad_request", "user_ids must be a non-empty array of strings");
  }
  if (!title || !msgBody) {
    return jsonError(400, "bad_request", "title and body are required");
  }

  // ---- 3. Look up Expo tokens for these users -----------------------------
  const { data: rows, error: tokensErr } = await adminClient
    .from("device_tokens")
    .select("expo_push_token")
    .in("user_id", userIds);

  if (tokensErr) {
    console.error("send-push db_error", tokensErr);
    return jsonError(500, "db_error", "Failed to look up device tokens");
  }

  const tokens = Array.from(
    new Set(
      (rows ?? [])
        .map((r) => (r as { expo_push_token: string }).expo_push_token)
        .filter((t) => typeof t === "string" && t.length > 0),
    ),
  );

  if (tokens.length === 0) {
    console.log(
      `send-push user_ids=${userIds.length} tokens=0 batches=0 ok=0 err=0 ms=${Date.now() - startedAt}`,
    );
    return jsonOk({ ok: true, tokens: 0, batches: 0, ok_count: 0, err_count: 0 });
  }

  // ---- 4. POST to Expo in batches of 100 ---------------------------------
  const batches = chunk(tokens, EXPO_BATCH_SIZE);
  let okCount = 0;
  let errCount = 0;
  // Track transport-level failures separately. If EVERY batch fails at the
  // transport layer (Expo unreachable / timeout / non-2xx), we return a
  // structured 502/504 instead of a 200 with err_count == tokens — that
  // matches the documented function contract and lets callers distinguish
  // "Expo down" from "we sent and Expo rejected some tokens".
  let transportFailures = 0;
  let lastTransportCode: ErrorCode | null = null;
  let lastTransportMessage = "";

  for (const batch of batches) {
    const messages = batch.map((to) => ({
      to,
      title,
      body: msgBody,
      sound: "default",
      ...(data ? { data } : {}),
    }));

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), EXPO_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutHandle);
      errCount += batch.length;
      transportFailures++;
      if ((err as Error)?.name === "AbortError") {
        lastTransportCode = "expo_timeout";
        lastTransportMessage = "Expo request timed out";
        console.error("send-push expo_timeout batch_size=" + batch.length);
      } else {
        lastTransportCode = "expo_unreachable";
        lastTransportMessage = "Failed to reach Expo";
        console.error("send-push expo_unreachable batch_size=" + batch.length, err);
      }
      continue;
    }
    clearTimeout(timeoutHandle);

    if (!res.ok) {
      errCount += batch.length;
      transportFailures++;
      lastTransportCode = "expo_error";
      lastTransportMessage = `Expo returned status ${res.status}`;
      try {
        const txt = await res.text();
        console.error(`send-push expo_error status=${res.status} body=${txt.slice(0, 500)}`);
      } catch {
        console.error(`send-push expo_error status=${res.status}`);
      }
      continue;
    }

    let json: { data?: Array<{ status?: string; message?: string; details?: unknown; id?: string }> };
    try {
      json = await res.json();
    } catch {
      errCount += batch.length;
      transportFailures++;
      lastTransportCode = "expo_bad_response";
      lastTransportMessage = "Malformed Expo response";
      console.error("send-push expo_bad_response batch_size=" + batch.length);
      continue;
    }

    const tickets = Array.isArray(json.data) ? json.data : [];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      // Log every ticket (last 8 chars of token only — never the full
      // token). Successful tickets carry an `id` we may need later to
      // pull receipts; error tickets carry status/message.
      const tail = String(batch[i] ?? "?").slice(-8);
      if (t && t.status === "ok") {
        okCount++;
        console.log(`send-push ticket_ok token=${tail} id=${t.id ?? "?"}`);
      } else {
        errCount++;
        console.error(
          `send-push ticket_error token=${tail} status=${t?.status} message=${t?.message ?? ""}`,
        );
      }
    }
    // If Expo returned fewer tickets than messages, count the rest as errors.
    if (tickets.length < batch.length) {
      errCount += batch.length - tickets.length;
    }
  }

  console.log(
    `send-push user_ids=${userIds.length} tokens=${tokens.length} batches=${batches.length} ok=${okCount} err=${errCount} transport_failures=${transportFailures} ms=${Date.now() - startedAt}`,
  );

  // Total transport failure (every batch failed before getting a ticket
  // back from Expo) -> structured 502/504 per the documented contract.
  // Partial failures (some tickets ok, others rejected by Expo at the
  // ticket level) still return 200 with err_count > 0.
  if (transportFailures === batches.length && lastTransportCode) {
    const status = lastTransportCode === "expo_timeout" ? 504 : 502;
    return jsonError(status, lastTransportCode, lastTransportMessage);
  }

  return jsonOk({
    ok: true,
    tokens: tokens.length,
    batches: batches.length,
    ok_count: okCount,
    err_count: errCount,
  });
});
