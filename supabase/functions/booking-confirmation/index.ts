// =============================================================================
// supabase/functions/booking-confirmation/index.ts
// =============================================================================
// Task #291 — Send a booking confirmation email after a public booking.
//
// Called from the public booking page immediately after a booking is created.
// Auth model: caller's JWT (the parent who just booked). RLS on the bookings
// table restricts access to the caller's own family — no privilege escalation.
// The function uses the service role only to look up the tenant name (tenants
// table is not readable by the anon/authenticated role without a matching
// tenant_id claim, which new accounts may not have in their first JWT).
//
// Contract (POST):
//   Header: Authorization: Bearer <caller_jwt>
//   Body:   { booking_id: string }
//   Response 200: { ok: true }             — email sent (or skipped if unconfigured)
//   Response 400: { error: { code, message } }
//   Response 404: { error: { code, message } }
//
// Best-effort delivery: if RESEND_API_KEY is absent or Resend times out, the
// function returns 200 so as not to fail the booking flow.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEmailSender, sendResendEmail as sendBrandedEmail } from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatSessionTime(isoString: string, timezone: string): string {
  const d = new Date(isoString);
  const tz = timezone || "America/Chicago";
  const datePart = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: tz,
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
  }).format(d);
  return `${datePart} at ${timePart}`;
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  businessName?: string | null;
  replyToEmail?: string | null;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log("booking-confirmation: RESEND_API_KEY not configured — skipping email");
    return;
  }
  const sender = buildEmailSender({ businessName: opts.businessName, replyToEmail: opts.replyToEmail });
  const result = await sendBrandedEmail({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    ...sender,
  });
  if (!result.ok) {
    console.error(`booking-confirmation resend_error: ${result.error}`);
  }
}

function buildConfirmationHtml(opts: {
  parentFirstName: string | null;
  kidFirstName: string;
  sessionTypeName: string;
  coachFirstName: string;
  coachLastName: string;
  timeLabel: string;
  locationName: string;
  tenantName: string;
  bookingRef: string;
}): string {
  const e = escapeHtml;
  const greeting = opts.parentFirstName
    ? `Hi ${e(opts.parentFirstName)},`
    : "Hi,";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Booking Confirmed</title></head>
<body style="font-family:system-ui,sans-serif;background:#f9f6ee;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6ee;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#1c1b1a;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
  <tr>
    <td style="background:#2d2b2a;padding:24px 32px;border-bottom:1px solid rgba(241,229,173,0.15);">
      <span style="font-size:20px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#fdfbf2;">${e(opts.tenantName)}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="color:#fdfbf2;font-size:16px;margin:0 0 8px;">${e(greeting)}</p>
      <h1 style="color:#f1e5ad;font-size:26px;font-weight:700;margin:0 0 24px;">✓ You&apos;re booked!</h1>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#2d2b2a;border-radius:12px;border:1px solid rgba(241,229,173,0.15);margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            ${[
              ["Session", opts.sessionTypeName],
              ["Athlete", opts.kidFirstName],
              ["Coach", `${opts.coachFirstName} ${opts.coachLastName}`],
              ["When", opts.timeLabel],
              ["Location", opts.locationName],
            ]
              .map(
                ([label, value]) => `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr><td style="color:#b8a268;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;padding-bottom:3px;">${e(label)}</td></tr>
              <tr><td style="color:#fdfbf2;font-size:15px;">${e(value)}</td></tr>
            </table>`,
              )
              .join("")}
          </td>
        </tr>
      </table>
      <p style="color:#9b9590;font-size:13px;margin:0 0 24px;">
        Confirmation ref: <strong style="color:#fdfbf2;">${e(opts.bookingRef)}</strong>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#2d2b2a;border-radius:12px;border:1px solid rgba(241,229,173,0.15);">
        <tr>
          <td style="padding:20px 24px;text-align:center;">
            <p style="color:#fdfbf2;font-size:14px;font-weight:600;margin:0 0 14px;">Track your progress in the Ballpark app</p>
            <a href="https://apps.apple.com/app/ballpark"
               style="display:inline-block;background:#f1e5ad;color:#1c1b1a;font-weight:600;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;margin:4px;">
              🍎 App Store
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.ballpark"
               style="display:inline-block;background:#f1e5ad;color:#1c1b1a;font-weight:600;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;margin:4px;">
              ▶ Google Play
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px;border-top:1px solid rgba(241,229,173,0.1);">
      <p style="color:#6b6560;font-size:12px;margin:0;">
        Booked via the ${e(opts.tenantName)} online booking page.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildConfirmationText(opts: {
  parentFirstName: string | null;
  kidFirstName: string;
  sessionTypeName: string;
  coachFirstName: string;
  coachLastName: string;
  timeLabel: string;
  locationName: string;
  tenantName: string;
  bookingRef: string;
}): string {
  const greeting = opts.parentFirstName ? `Hi ${opts.parentFirstName},` : "Hi,";
  const coachName = `${opts.coachFirstName} ${opts.coachLastName}`.trim();
  return [
    `${opts.tenantName}`,
    ``,
    greeting,
    ``,
    `You're booked!`,
    ``,
    `Session:   ${opts.sessionTypeName}`,
    `Athlete:   ${opts.kidFirstName}`,
    `Coach:     ${coachName}`,
    `When:      ${opts.timeLabel}`,
    `Location:  ${opts.locationName}`,
    ``,
    `Confirmation ref: ${opts.bookingRef}`,
    ``,
    `Track your progress in the Ballpark app:`,
    `  App Store:    https://apps.apple.com/app/ballpark`,
    `  Google Play:  https://play.google.com/store/apps/details?id=com.ballpark`,
    ``,
    `Booked via the ${opts.tenantName} online booking page.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

// The public booking page is served from the same origin as the portal
// (REPLIT_DEV_DOMAIN), but browser preflight still fires for custom headers
// (Authorization). We allow all origins since this is a public booking page.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function corsOk(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function addCors(r: Response): Response {
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
  return new Response(r.body, { status: r.status, headers: h });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") return corsOk();

  if (req.method !== "POST") {
    return addCors(jsonError(405, "method_not_allowed", "POST required"));
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return addCors(jsonError(401, "unauthorized", "Authorization: Bearer <token> required"));
  }

  let body: { booking_id?: string };
  try {
    body = await req.json();
  } catch {
    return addCors(jsonError(400, "bad_request", "Invalid JSON body"));
  }
  const bookingId =
    typeof body.booking_id === "string" ? body.booking_id.trim() : "";
  if (!bookingId) {
    return addCors(jsonError(400, "bad_request", "booking_id is required"));
  }

  // Caller-scoped client — RLS restricts to the parent's own bookings.
  // This prevents any user from fetching another family's booking details.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Fetch the booking with all related data in one round-trip.
  const { data: raw, error: fetchErr } = await callerClient
    .from("bookings")
    .select(
      `id, scheduled_start, tenant_id,
       session_type:session_types(name),
       coach:coaches(first_name, last_name),
       location:locations(name, timezone, email),
       kid:kids(first_name, family:families(parent_first_name, parent_email))`
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchErr) {
    console.error("booking-confirmation db_fetch_error", fetchErr.message);
    return addCors(jsonError(500, "db_error", fetchErr.message));
  }
  if (!raw) {
    return addCors(jsonError(404, "not_found", "Booking not found"));
  }

  // Type-safe extraction
  const bk = raw as {
    id: string;
    scheduled_start: string;
    tenant_id: string;
    session_type: { name: string } | null;
    coach: { first_name: string; last_name: string } | null;
    location: { name: string; timezone: string; email: string | null } | null;
    kid: {
      first_name: string;
      family: { parent_first_name: string; parent_email: string } | null;
    } | null;
  };

  const parentEmail = bk.kid?.family?.parent_email ?? null;
  if (!parentEmail) {
    console.log("booking-confirmation: no parent email for booking", bookingId);
    return addCors(jsonOk({ ok: true, skipped: "no_parent_email" }));
  }

  // Fetch tenant name via service role — tenants RLS blocks anon/fresh JWTs
  // that don't yet carry the tenant_id claim (common right after signup).
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: tenantRow } = await adminClient
    .from("tenants")
    .select("name")
    .eq("id", bk.tenant_id)
    .maybeSingle();

  const tenantName = (tenantRow as { name?: string } | null)?.name ?? "Ballpark";
  const timeLabel = formatSessionTime(
    bk.scheduled_start,
    bk.location?.timezone ?? "America/Chicago"
  );

  const emailOpts = {
    parentFirstName: bk.kid?.family?.parent_first_name ?? null,
    kidFirstName: bk.kid?.first_name ?? "Athlete",
    sessionTypeName: bk.session_type?.name ?? "Session",
    coachFirstName: bk.coach?.first_name ?? "Coach",
    coachLastName: bk.coach?.last_name ?? "",
    timeLabel,
    locationName: bk.location?.name ?? "the facility",
    tenantName,
    bookingRef: bk.id.slice(0, 8).toUpperCase(),
  };

  await sendResendEmail({
    to: parentEmail,
    subject: `Booking confirmed: ${emailOpts.sessionTypeName} on ${timeLabel}`,
    html: buildConfirmationHtml(emailOpts),
    text: buildConfirmationText(emailOpts),
    businessName: tenantName,
    replyToEmail: bk.location?.email ?? null,
  });

  return addCors(jsonOk({ ok: true }));
});
