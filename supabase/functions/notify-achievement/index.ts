// =============================================================================
// supabase/functions/notify-achievement/index.ts
// =============================================================================
// v0.7 task #122 — push fan-out for the achievement-earned event.
//
// Called from the `_grant_achievement` Postgres function via
// pg_net.http_post when a new kid_achievements row is inserted. Best-
// effort: looks up the parent_user_id behind the kid and forwards a
// push payload to send-push-notification. Returns 200 even when there
// is no token / no parent — the trigger that fires us never retries on
// non-2xx, so the contract is "ack-and-go".
//
// Auth: service-role bearer in Authorization (same convention as the
// rest of our internal-only Edge Functions).
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

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

  let body: { kid_id?: string; achievement_id?: string; achievement_key?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON");
  }

  const kidId = typeof body.kid_id === "string" ? body.kid_id : "";
  const achId = typeof body.achievement_id === "string" ? body.achievement_id : "";
  if (!kidId || !achId) {
    return jsonError(400, "bad_request", "kid_id + achievement_id required");
  }

  // Resolve the parent + kid first name + achievement metadata.
  const [{ data: kidRow }, { data: ach }] = await Promise.all([
    adminClient
      .from("kids")
      .select("first_name, family_id, families!inner(parent_user_id)")
      .eq("id", kidId)
      .maybeSingle(),
    adminClient
      .from("achievements")
      .select("name, points_bonus")
      .eq("id", achId)
      .maybeSingle(),
  ]);

  // Family relation comes back nested; coerce safely.
  const families = (kidRow as { families?: { parent_user_id?: string } | null } | null)?.families;
  const parentUserId = families?.parent_user_id ?? null;
  const kidFirst = (kidRow as { first_name?: string } | null)?.first_name ?? "Your athlete";
  const achName = ach?.name ?? "an achievement";
  const bonus = ach?.points_bonus ?? 0;

  if (!parentUserId) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_parent" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const r = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      user_ids: [parentUserId],
      title: `🏆 ${kidFirst} earned: ${achName}`,
      body: bonus > 0 ? `+${bonus} pts added to their balance.` : "Tap to see the badge.",
      data: { kind: "achievement_earned", achievement_id: achId, kid_id: kidId },
    }),
  }).catch((err) => {
    console.error("notify-achievement send-push fetch failed", err);
    return null;
  });

  if (r && !r.ok) {
    const txt = await r.text().catch(() => "");
    console.error(
      `notify-achievement send-push status=${r.status} body=${txt.slice(0, 200)}`,
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
