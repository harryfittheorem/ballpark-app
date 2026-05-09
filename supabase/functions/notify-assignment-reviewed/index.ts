// =============================================================================
// supabase/functions/notify-assignment-reviewed/index.ts
// =============================================================================
// v0.7 task #122 — push fan-out for "coach reviewed your homework".
//
// Called from the mobile coach review flow AFTER `review_assignment` RPC
// succeeds. The client passes the assignment_id; we look up the kid +
// parent + rating and forward a push to send-push-notification.
//
// Auth: service-role bearer. Mobile clients can NOT call this directly
// (they don't have service-role); the coach app calls it via a thin
// internal Edge Function relay or the post-review hook in the future.
// For task #122 we keep it service-role-only and the coach screen invokes
// it from the on-device review-success path using anon key + a RPC that
// proxies through. Documented as a follow-up.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed", "POST required");
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ") ||
      auth.slice(7).trim() !== SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(401, "unauthorized", "Service role required");
  }

  let body: { assignment_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON");
  }
  const assignmentId = typeof body.assignment_id === "string" ? body.assignment_id : "";
  if (!assignmentId) {
    return jsonError(400, "bad_request", "assignment_id required");
  }

  const { data: a } = await adminClient
    .from("assignments")
    .select("id, kid_id, title, rating, status")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a || a.status !== "reviewed") {
    return new Response(JSON.stringify({ ok: true, skipped: "not_reviewed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: kidRow } = await adminClient
    .from("kids")
    .select("first_name, families!inner(parent_user_id)")
    .eq("id", a.kid_id)
    .maybeSingle();
  const families = (kidRow as { families?: { parent_user_id?: string } | null } | null)?.families;
  const parentUserId = families?.parent_user_id ?? null;
  const kidFirst = (kidRow as { first_name?: string } | null)?.first_name ?? "Your athlete";

  if (!parentUserId) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_parent" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stars = "⭐".repeat(Math.max(1, Math.min(5, a.rating ?? 1)));
  await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      user_ids: [parentUserId],
      title: `Coach reviewed ${kidFirst}'s homework ${stars}`,
      body: a.title ?? "Tap to read the feedback.",
      data: { kind: "assignment_reviewed", assignment_id: assignmentId },
    }),
  }).catch((err) => {
    console.error("notify-assignment-reviewed push fetch failed", err);
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
