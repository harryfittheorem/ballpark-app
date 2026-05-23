// =============================================================================
// supabase/functions/send-booking-reminders/index.ts
// =============================================================================
// Task #234 — Automated booking reminders (24h + 2h before session).
//
// Called every 30 minutes by two pg_cron jobs registered in migration
// 20260601000006_booking_reminder_log.sql:
//   booking-reminder-24h  -> POST { reminder_type: "24h" }
//   booking-reminder-2h   -> POST { reminder_type: "2h" }
//
// Can also be invoked manually for ops/testing with reminder_type in either
// the query string or the JSON body (query string takes precedence):
//   curl -X POST \
//     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
//     "https://<project>.supabase.co/functions/v1/send-booking-reminders?reminder_type=24h"
//   # or:
//   curl -X POST \
//     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"reminder_type":"24h"}' \
//     "https://<project>.supabase.co/functions/v1/send-booking-reminders"
//
// Auth model:
//   Service-role only. Authorization: Bearer <SERVICE_ROLE_KEY> required.
//   Deployed with default JWT verification ON.
//
// Contract (POST):
//   Query param OR body field: reminder_type = "24h" | "2h"
//   Response 200: { ok: true, sent: number, skipped: number }
//   Errors: { error: { code, message } }
//
// Query windows:
//   24h: bookings with scheduled_start BETWEEN now()+23h AND now()+25h
//    2h: bookings with scheduled_start BETWEEN now()+1h  AND now()+3h
//
// Idempotency (atomic insert-first pattern):
//   For each eligible booking, we attempt to INSERT a row into
//   booking_reminder_log (booking_id, reminder_type) before sending any
//   notification. The INSERT uses ON CONFLICT DO NOTHING. We check whether
//   the row was actually created (Supabase returns the inserted row on success
//   or null on conflict). Only if the INSERT succeeded do we fire push + email.
//   This means two concurrent invocations will race on the INSERT; exactly one
//   wins the unique constraint and sends; the other sees null and skips.
//   The log table is the final gate — the pre-check SELECT at the batch level
//   is an optimisation only, not the idempotency boundary.
//
// Delivery semantics (best-effort, consistent with other Edge Functions):
//   Push and email are fired via Promise.allSettled. One channel failing does
//   not block the other. The log row is written BEFORE delivery (see above),
//   so a partial delivery (e.g. push sent, email timeout) will NOT be retried
//   on the next cron tick — matching the existing pattern of
//   fanOutCoachVideoNotifications and notify-achievement. This is acceptable
//   because: (a) push and Resend are highly reliable, (b) retrying would
//   risk duplicate pushes, which is worse than a missed email.
//
// Timezone handling:
//   The session time is formatted in the booking's location timezone
//   (locations.timezone, defaulting to America/Chicago). Deno's Intl API
//   supports the full IANA tz database.
//
// Email template:
//   Kid name, session type, coach name, date/time in location tz, facility
//   address, and a one-tap cancellation deep link
//   (ballpark://book/cancel/{booking_id}).
//
// Push notification copy:
//   24h: "Reminder: {kid}'s {session_type} with Coach {coach} is tomorrow at {time}"
//    2h: "Heads up: {kid}'s session with Coach {coach} starts in 2 hours"
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

type ReminderType = "24h" | "2h";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonError(status: number, code: string, message: string): Response {
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format a UTC ISO timestamp in the given IANA timezone for display.
 * e.g. "Thursday, Jan 9 at 3:00 PM"
 */
function formatSessionTime(
  isoString: string,
  timezone: string,
): { dateLabel: string; timeLabel: string; fullLabel: string } {
  const d = new Date(isoString);
  const tz = timezone || "America/Chicago";

  const datePart = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(d);

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(d);

  return {
    dateLabel: datePart,
    timeLabel: timePart,
    fullLabel: `${datePart} at ${timePart}`,
  };
}

/**
 * Build the eligibility window for the given reminder type.
 * Returns [windowStart ISO, windowEnd ISO] in UTC.
 *
 * 24h window: bookings starting between 23h and 25h from now
 *  2h window: bookings starting between  1h and  3h from now
 */
function reminderWindow(type: ReminderType): [string, string] {
  const now = Date.now();
  if (type === "24h") {
    return [
      new Date(now + 23 * 60 * 60 * 1000).toISOString(),
      new Date(now + 25 * 60 * 60 * 1000).toISOString(),
    ];
  }
  return [
    new Date(now + 1 * 60 * 60 * 1000).toISOString(),
    new Date(now + 3 * 60 * 60 * 1000).toISOString(),
  ];
}

/**
 * Build the location address string from available fields.
 */
function buildAddress(location: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const parts: string[] = [];
  if (location.address) parts.push(location.address);
  const cityState = [location.city, location.state].filter(Boolean).join(", ");
  if (cityState) parts.push(cityState);
  if (location.zip) parts.push(location.zip);
  return parts.join(", ") || "the facility";
}

/**
 * Send a push notification to all device tokens for a user.
 * Best-effort — failures are logged but never throw.
 */
async function sendPush(opts: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const r = await fetch(`${FN_BASE}/send-push-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      user_ids: opts.userIds,
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
    }),
  }).catch((err) => {
    console.error("send-booking-reminders push fetch_err", err);
    return null;
  });
  if (r && !r.ok) {
    const txt = await r.text().catch(() => "");
    console.error(
      `send-booking-reminders push status=${r.status} body=${txt.slice(0, 200)}`,
    );
  }
}

/**
 * Send a Resend email. Best-effort — failures are logged but never throw.
 */
async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error("send-booking-reminders missing RESEND_API_KEY — skipping email");
    return;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  try {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);
    if (!r.ok) {
      try { await r.text(); } catch { /* swallow PII */ }
      console.error(`send-booking-reminders email resend_error status=${r.status}`);
    }
  } catch (err) {
    clearTimeout(timeoutHandle);
    if ((err as Error)?.name === "AbortError") {
      console.error("send-booking-reminders email resend_timeout");
    } else {
      console.error("send-booking-reminders email resend_unreachable", err);
    }
  }
}

/**
 * Build the reminder email HTML.
 */
function buildEmailHtml(opts: {
  parentFirstName: string | null;
  kidFirstName: string;
  sessionTypeName: string;
  coachFirstName: string;
  fullTimeLabel: string;
  locationName: string;
  locationAddress: string;
  bookingId: string;
  reminderType: ReminderType;
}): string {
  const {
    parentFirstName,
    kidFirstName,
    sessionTypeName,
    coachFirstName,
    fullTimeLabel,
    locationName,
    locationAddress,
    bookingId,
    reminderType,
  } = opts;

  const greeting = reminderType === "24h"
    ? `${escapeHtml(kidFirstName)}'s session is tomorrow`
    : `${escapeHtml(kidFirstName)}'s session starts in 2 hours`;

  const cancelLink = `ballpark://book/cancel/${bookingId}`;

  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">&#9200; ${escapeHtml(greeting)}</h1>
      <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px;">
        Hi ${escapeHtml(parentFirstName ?? "there")},
      </p>
      <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px;">
        Just a reminder that <strong>${escapeHtml(kidFirstName)}</strong> has a
        <strong>${escapeHtml(sessionTypeName)}</strong> with
        <strong>Coach ${escapeHtml(coachFirstName)}</strong>
        on <strong>${escapeHtml(fullTimeLabel)}</strong>.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 10px 14px; font-size: 14px; color: #666; width: 40%;">Location</td>
          <td style="padding: 10px 14px; font-size: 14px; font-weight: 600;">${escapeHtml(locationName)}</td>
        </tr>
        <tr style="border-top: 1px solid #eee;">
          <td style="padding: 10px 14px; font-size: 14px; color: #666;">Address</td>
          <td style="padding: 10px 14px; font-size: 14px;">${escapeHtml(locationAddress)}</td>
        </tr>
      </table>
      <p style="margin: 0 0 8px;">
        <a href="ballpark://"
           style="display: inline-block; background: #FF6A00; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
          Open in Ballpark
        </a>
      </p>
      <p style="font-size: 12px; color: #999; margin: 16px 0 0;">
        Need to cancel?
        <a href="${escapeHtml(cancelLink)}" style="color: #999;">Tap here to cancel in the app.</a>
      </p>
    </div>
  `;
}

/**
 * Resolve reminder_type from query string (takes precedence) or JSON body.
 * Returns the type string or null if absent/invalid.
 */
async function resolveReminderType(
  req: Request,
): Promise<{ type: ReminderType | null; error?: string }> {
  // Query string takes precedence — allows bare POST with no body (cron style)
  // and also curl -X POST "...?reminder_type=24h" without Content-Type.
  const url = new URL(req.url);
  const qp = url.searchParams.get("reminder_type");
  if (qp !== null) {
    if (qp === "24h" || qp === "2h") return { type: qp };
    return { type: null, error: `reminder_type query param must be '24h' or '2h', got '${qp}'` };
  }

  // Fall back to JSON body. Tolerate an empty body (cron jobs may omit it
  // when the param is in the query string).
  const contentLength = req.headers.get("content-length");
  const hasBody = contentLength !== "0" && contentLength !== null;
  if (!hasBody) {
    return { type: null, error: "reminder_type required (query param or JSON body)" };
  }

  let body: { reminder_type?: unknown };
  try {
    body = await req.json();
  } catch {
    return { type: null, error: "Body is not valid JSON" };
  }

  const rt = body.reminder_type;
  if (rt === "24h" || rt === "2h") return { type: rt };
  return { type: null, error: "reminder_type must be '24h' or '2h'" };
}

serve(async (req) => {
  const startedAt = Date.now();

  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed", "POST required");
  }

  // ---- 1. Service-role auth check ------------------------------------------
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(401, "unauthorized", "Service role required");
  }

  // ---- 2. Resolve reminder_type (query string takes precedence over body) ---
  const { type: reminderType, error: rtError } = await resolveReminderType(req);
  if (!reminderType) {
    return jsonError(400, "bad_request", rtError ?? "reminder_type required");
  }

  // ---- 3. Query eligible bookings ------------------------------------------
  const [windowStart, windowEnd] = reminderWindow(reminderType);

  // Fetch confirmed bookings in the window with all data needed to build
  // notifications. Only status='confirmed' is returned — cancelled and
  // completed bookings are excluded by the eq filter.
  const { data: bookings, error: bookingsErr } = await adminClient
    .from("bookings")
    .select(
      `id, scheduled_start, scheduled_end, status, tenant_id,
       kid:kids(id, first_name, family_id),
       coach:coaches(id, first_name),
       location:locations(id, name, timezone, address, city, state, zip),
       session_type:session_types(id, name)`,
    )
    .eq("status", "confirmed")
    .gte("scheduled_start", windowStart)
    .lte("scheduled_start", windowEnd);

  if (bookingsErr) {
    console.error("send-booking-reminders db_error fetching bookings", bookingsErr);
    return jsonError(500, "db_error", "Failed to query bookings");
  }

  const eligible = bookings ?? [];
  if (eligible.length === 0) {
    console.log(
      `send-booking-reminders reminder_type=${reminderType} eligible=0 ms=${Date.now() - startedAt}`,
    );
    return jsonOk({ ok: true, sent: 0, skipped: 0 });
  }

  // ---- 4. Batch-optimisation: pre-filter bookings already in the log -------
  // This is NOT the idempotency gate (that's the atomic INSERT below).
  // It's an optimisation to skip the family-lookup and send calls when the
  // entire batch has already been processed — common on re-runs within the
  // same window. The real idempotency enforcement is per-booking at step 6.
  const bookingIds = eligible.map((b) => b.id);
  const { data: alreadySent, error: logErr } = await adminClient
    .from("booking_reminder_log")
    .select("booking_id")
    .in("booking_id", bookingIds)
    .eq("reminder_type", reminderType);

  if (logErr) {
    console.error("send-booking-reminders db_error fetching log", logErr);
    return jsonError(500, "db_error", "Failed to query reminder log");
  }

  const sentSet = new Set((alreadySent ?? []).map((r) => r.booking_id as string));
  const toSend = eligible.filter((b) => !sentSet.has(b.id));

  if (toSend.length === 0) {
    console.log(
      `send-booking-reminders reminder_type=${reminderType} eligible=${eligible.length} already_sent=${eligible.length} to_send=0 ms=${Date.now() - startedAt}`,
    );
    return jsonOk({ ok: true, sent: 0, skipped: eligible.length });
  }

  // ---- 5. Gather family data for recipients ----------------------------------
  const familyIds: string[] = [];
  for (const b of toSend) {
    const kid = b.kid as { id: string; first_name: string; family_id: string } | null;
    if (kid?.family_id) familyIds.push(kid.family_id);
  }
  const uniqueFamilyIds = [...new Set(familyIds)];

  const { data: families, error: famErr } = await adminClient
    .from("families")
    .select("id, parent_user_id, parent_email, parent_first_name")
    .in("id", uniqueFamilyIds);

  if (famErr) {
    console.error("send-booking-reminders db_error fetching families", famErr);
    return jsonError(500, "db_error", "Failed to query families");
  }

  const familyMap = new Map<
    string,
    { parent_user_id: string; parent_email: string | null; parent_first_name: string | null }
  >();
  for (const f of families ?? []) {
    familyMap.set(f.id, {
      parent_user_id: f.parent_user_id,
      parent_email: f.parent_email,
      parent_first_name: f.parent_first_name,
    });
  }

  // ---- 6. Per-booking: atomic claim → send → done --------------------------
  // Idempotency pattern: INSERT log row FIRST (ON CONFLICT DO NOTHING).
  // If the insert returns a row, we won the race and must send.
  // If it returns null (conflict), another process already sent — skip.
  // This prevents duplicate sends even when two cron ticks overlap.
  let sentCount = 0;
  let skippedCount = eligible.length - toSend.length;

  for (const booking of toSend) {
    const kid = booking.kid as { id: string; first_name: string; family_id: string } | null;
    const coach = booking.coach as { id: string; first_name: string } | null;
    const location = booking.location as {
      id: string;
      name: string;
      timezone: string;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    } | null;
    const sessionType = booking.session_type as { id: string; name: string } | null;

    if (!kid || !location || !sessionType) {
      console.error(
        `send-booking-reminders booking_id=${booking.id} skipped=missing_relations`,
      );
      skippedCount++;
      continue;
    }

    const family = familyMap.get(kid.family_id);
    if (!family) {
      console.error(
        `send-booking-reminders booking_id=${booking.id} skipped=no_family`,
      );
      skippedCount++;
      continue;
    }

    // --- Atomic idempotency claim (INSERT before send) ----------------------
    // ON CONFLICT DO NOTHING — Supabase returns the inserted row on success
    // or an empty array on conflict. Zero rows = already claimed by another
    // concurrent run; skip.
    const { data: claimRows, error: claimErr } = await adminClient
      .from("booking_reminder_log")
      .insert({
        booking_id: booking.id,
        reminder_type: reminderType,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .returns<{ id: string }[]>();

    if (claimErr) {
      // Error code 23505 = unique_violation — another process beat us to it.
      if (claimErr.code === "23505") {
        console.log(
          `send-booking-reminders reminder_type=${reminderType} booking_id=${booking.id} skipped=race_conflict`,
        );
        skippedCount++;
        continue;
      }
      // Unexpected DB error — log it and skip this booking rather than
      // crashing the entire batch.
      console.error(
        `send-booking-reminders log_claim_err booking_id=${booking.id}`,
        claimErr,
      );
      skippedCount++;
      continue;
    }

    if (!claimRows || claimRows.length === 0) {
      // ON CONFLICT DO NOTHING returned 0 rows — already sent.
      console.log(
        `send-booking-reminders reminder_type=${reminderType} booking_id=${booking.id} skipped=already_sent`,
      );
      skippedCount++;
      continue;
    }

    // --- We hold the claim — now send push + email --------------------------
    const kidFirst = kid.first_name;
    const coachFirst = coach?.first_name ?? "your coach";
    const { fullLabel: fullTimeLabel, timeLabel } = formatSessionTime(
      booking.scheduled_start,
      location.timezone,
    );

    const pushTitle =
      reminderType === "24h"
        ? `Reminder: ${kidFirst}'s ${sessionType.name} with Coach ${coachFirst} is tomorrow at ${timeLabel}`
        : `Heads up: ${kidFirst}'s session with Coach ${coachFirst} starts in 2 hours`;
    const pushBody =
      reminderType === "24h"
        ? `See you at ${location.name} on ${fullTimeLabel}.`
        : `Head to ${location.name} — see you soon!`;

    const emailHtml = buildEmailHtml({
      parentFirstName: family.parent_first_name,
      kidFirstName: kidFirst,
      sessionTypeName: sessionType.name,
      coachFirstName: coachFirst,
      fullTimeLabel,
      locationName: location.name,
      locationAddress: buildAddress(location),
      bookingId: booking.id,
      reminderType,
    });

    const subject =
      reminderType === "24h"
        ? `Reminder: ${kidFirst}'s ${sessionType.name} is tomorrow`
        : `${kidFirst}'s session starts in 2 hours`;

    // Best-effort: both channels are attempted regardless of individual
    // failures. The log row was already written above, so even a total
    // delivery failure will not trigger a re-send on the next cron tick.
    // This is consistent with the existing notification fan-out pattern
    // (fanOutCoachVideoNotifications, notify-achievement).
    await Promise.allSettled([
      sendPush({
        userIds: [family.parent_user_id],
        title: pushTitle,
        body: pushBody,
        data: {
          kind: "booking_reminder",
          booking_id: booking.id,
          reminder_type: reminderType,
        },
      }),
      family.parent_email
        ? sendEmail({ to: family.parent_email, subject, html: emailHtml })
        : Promise.resolve(),
    ]);

    sentCount++;
    console.log(
      `send-booking-reminders reminder_type=${reminderType} booking_id=${booking.id} kid=${kidFirst} sent=true`,
    );
  }

  console.log(
    `send-booking-reminders reminder_type=${reminderType} eligible=${eligible.length} sent=${sentCount} skipped=${skippedCount} ms=${Date.now() - startedAt}`,
  );
  return jsonOk({ ok: true, sent: sentCount, skipped: skippedCount });
});
