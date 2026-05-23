// =============================================================================
// supabase/functions/promote-waitlist/index.ts
// =============================================================================
// Finds the first 'waiting' entry for a session slot and promotes it to
// 'notified', setting claim_deadline = NOW() + 2 hours, then sends an Expo
// push notification and Resend email to the family.
//
// Called by:
//   - DB trigger on bookings.status → cancelled/no_show
//   - expire_stale_waitlist_entries() pg_cron job (cascade to next in queue)
//   - Operator scripts (for manual testing)
//
// Contract (POST):
//   Headers: Authorization: Bearer <SERVICE_ROLE_KEY>
//   Body: { session_slot_key: string; tenant_id: string }
//   Response 200: { promoted: number; waitlist_id?: string }
//   Errors: 401 unauthorized | 400 bad_request
//
// Auth: service-role only.
// Deploy: npx supabase functions deploy promote-waitlist
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

const CLAIM_WINDOW_HOURS = 2;
const RESEND_TIMEOUT_MS = 10_000;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour12: true,
      timeZone: "America/New_York",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed", "POST required");
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (
    !auth.toLowerCase().startsWith("bearer ") ||
    auth.slice(7).trim() !== SUPABASE_SERVICE_ROLE_KEY
  ) {
    return jsonError(401, "unauthorized", "Service role required");
  }

  let body: { session_slot_key?: string; tenant_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON");
  }

  const slotKey = typeof body.session_slot_key === "string" ? body.session_slot_key : "";
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";

  if (!slotKey || !tenantId) {
    return jsonError(400, "bad_request", "session_slot_key + tenant_id required");
  }

  // Find first 'waiting' entry for this slot (ordered by position asc)
  const { data: entry, error: fetchErr } = await adminClient
    .from("booking_waitlist")
    .select(`
      id, tenant_id, session_slot_key, kid_id, family_id, coach_id,
      session_type_id, location_id, scheduled_start, scheduled_end, position,
      families!inner(parent_user_id, contact_email),
      kids!inner(first_name),
      session_types!inner(name)
    `)
    .eq("session_slot_key", slotKey)
    .eq("tenant_id", tenantId)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    console.error("[promote-waitlist] fetch error:", fetchErr.message);
    return jsonError(500, "db_error", fetchErr.message);
  }

  if (!entry) {
    // No one waiting — return 0 promotions (normal, not an error)
    return jsonOk({ promoted: 0 });
  }

  const claimDeadline = new Date(Date.now() + CLAIM_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Promote to notified
  const { error: updateErr } = await adminClient
    .from("booking_waitlist")
    .update({
      status: "notified",
      notified_at: new Date().toISOString(),
      claim_deadline: claimDeadline,
    })
    .eq("id", entry.id)
    .eq("status", "waiting"); // idempotency guard

  if (updateErr) {
    console.error("[promote-waitlist] update error:", updateErr.message);
    return jsonError(500, "db_error", updateErr.message);
  }

  // ── Resolve parent user_id + contact info ──────────────────────────────────
  const familyRow = entry.families as unknown as {
    parent_user_id: string;
    contact_email: string | null;
  } | null;
  const kidRow = entry.kids as unknown as { first_name: string } | null;
  const stRow = entry.session_types as unknown as { name: string } | null;

  const parentUserId = familyRow?.parent_user_id ?? null;
  const parentEmail = familyRow?.contact_email ?? null;
  const kidFirst = kidRow?.first_name ?? "Your athlete";
  const sessionName = stRow?.name ?? "session";
  const sessionTime = formatTime(entry.scheduled_start);

  // ── Best-effort: push + email ──────────────────────────────────────────────
  const results = await Promise.allSettled([
    // Push
    parentUserId
      ? fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_ids: [parentUserId],
            title: "A spot opened up! 🎉",
            body: `${kidFirst} can claim a ${sessionName} — you have 2 hours.`,
            data: {
              kind: "waitlist_promoted",
              waitlist_id: entry.id,
              tenant_id: tenantId,
            },
          }),
        }).catch((e) => {
          console.error("[promote-waitlist] push failed:", e);
          return null;
        })
      : Promise.resolve(null),

    // Email
    parentEmail && RESEND_API_KEY
      ? (async () => {
          const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #0e0e0e; color: #f5f5f5; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #333;">
    <h2 style="color: #f1e5ad; margin-top: 0;">A spot opened up! 🎉</h2>
    <p>${escapeHtml(kidFirst)} is next on the waitlist for:</p>
    <p style="font-size: 18px; font-weight: bold; color: #f1e5ad;">
      ${escapeHtml(sessionName)}<br>
      <span style="font-size: 14px; font-weight: normal; color: #aaa;">${escapeHtml(sessionTime)}</span>
    </p>
    <p>You have <strong style="color: #f1e5ad;">2 hours</strong> to claim this spot before it moves to the next family.</p>
    <p>Open the Ballpark app to claim your spot.</p>
    <p style="font-size: 12px; color: #666;">This notification was sent because your family is on the waitlist. If you no longer need the spot, you can leave the waitlist in the app.</p>
  </div>
</body>
</html>`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: RESEND_FROM_EMAIL,
                to: [parentEmail],
                subject: `Spot available! Claim ${sessionName} for ${kidFirst}`,
                html: emailHtml,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!r.ok) {
              console.error("[promote-waitlist] Resend error:", r.status, await r.text());
            }
          } catch (e) {
            clearTimeout(timeout);
            console.error("[promote-waitlist] email fetch failed:", e);
          }
        })()
      : Promise.resolve(null),
  ]);

  const pushOk = results[0].status === "fulfilled";
  const emailOk = results[1].status === "fulfilled";

  console.log(
    `[promote-waitlist] slot=${slotKey} promoted=1 id=${entry.id} push=${pushOk} email=${emailOk}`
  );

  return jsonOk({ promoted: 1, waitlist_id: entry.id });
});
