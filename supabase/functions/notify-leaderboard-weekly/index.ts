// =============================================================================
// supabase/functions/notify-leaderboard-weekly/index.ts
// =============================================================================
// v0.7 task #122 — weekly Top-10 leaderboard fan-out.
//
// Designed to be invoked once a week (operator script or pg_cron). For
// every tenant: ranks kids by points_balance, takes the top 10, and
// pushes a "you made the Top 10!" notification to each of those parents.
// Also grants the `top_10_leaderboard` achievement so the badge appears
// in Profile.
//
// Auth: service-role bearer (same convention as send-push-notification).
// Idempotency: the achievement-grant is ON CONFLICT DO NOTHING, and the
// push itself is best-effort — re-running this function the same week
// does NOT spam parents because we additionally gate the push on "this
// kid was NOT in the top 10 a week ago" via points_ledger reconstruction.
// (For the v1 cut we accept a duplicate push if the operator runs it
// twice in a row — explicit dedupe table is task #122 follow-up.)
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

  // Pull every tenant id, then iterate.
  const { data: tenants, error: tErr } = await adminClient
    .from("tenants")
    .select("id");
  if (tErr) {
    console.error("notify-leaderboard-weekly tenants fetch failed", tErr);
    return jsonError(500, "db_error", tErr.message);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let pushed = 0;

  for (const tenant of tenants ?? []) {
    const { data: kids } = await adminClient
      .from("kids")
      .select("id, first_name, family_id, points_balance, families!inner(tenant_id, parent_user_id)")
      .eq("families.tenant_id", tenant.id)
      .order("points_balance", { ascending: false })
      .limit(50);

    if (!kids || kids.length === 0) continue;

    // Reconstruct points-as-of-7-days-ago for the dedupe gate.
    const { data: ledger } = await adminClient
      .from("points_ledger")
      .select("kid_id, delta")
      .eq("tenant_id", tenant.id)
      .gte("created_at", sevenDaysAgo);
    const recentDeltas = new Map<string, number>();
    (ledger ?? []).forEach((row) => {
      recentDeltas.set(
        row.kid_id,
        (recentDeltas.get(row.kid_id) ?? 0) + row.delta,
      );
    });
    const oldRanks = [...kids]
      .map((k) => ({ id: k.id, points: k.points_balance - (recentDeltas.get(k.id) ?? 0) }))
      .sort((a, b) => b.points - a.points)
      .map((k, i) => ({ id: k.id, rank: i + 1 }));
    const oldTop10 = new Set(oldRanks.filter((r) => r.rank <= 10).map((r) => r.id));

    const top10 = kids.slice(0, 10);
    for (const kid of top10) {
      // Grant the badge (idempotent).
      await adminClient.rpc("_grant_achievement" as never, {
        p_kid_id: kid.id,
        p_key: "top_10_leaderboard",
      } as never).catch((err: unknown) => {
        console.error("notify-leaderboard-weekly grant failed", err);
      });

      // Don't re-push parents who were already in the top 10 last week.
      if (oldTop10.has(kid.id)) continue;

      const families = (kid as { families?: { parent_user_id?: string } | null }).families;
      const parentUserId = families?.parent_user_id ?? null;
      if (!parentUserId) continue;

      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          user_ids: [parentUserId],
          title: `${(kid as { first_name?: string }).first_name ?? "Your athlete"} cracked the Top 10!`,
          body: "Open Ballpark to see this week's leaderboard.",
          data: { kind: "leaderboard_top_10", tenant_id: tenant.id, kid_id: kid.id },
        }),
      }).catch((err) => {
        console.error("notify-leaderboard-weekly push fetch failed", err);
        return null;
      });
      if (r?.ok) pushed += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, pushed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
