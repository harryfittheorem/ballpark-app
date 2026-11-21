// =============================================================================
// supabase/functions/send-coach-video-notification/index.ts
// =============================================================================
// v0.7 (task #93) — Resend email for "your coach sent your kid a video".
//
// Called from inside `mux-webhook` on `video.asset.ready` once the row's
// `purpose='coach_message'`. The push side is handled by
// `send-push-notification`; this function owns the email leg only.
//
// Contract (POST):
//   Headers:
//     Authorization: Bearer <SERVICE_ROLE_KEY>   required
//   Body (JSON):
//     { video_id: string }
//   Response 200:
//     { ok: true, message_id?: string }            email sent (Resend id)
//     { ok: true, skipped: "not_a_coach_message" } purpose != 'coach_message'
//     { ok: true, skipped: "no_parent_email"     } family has no email on file
//   Errors:        { error: { code, message } }
//     401 unauthorized | 400 bad_request | 404 not_found
//     500 db_error
//     502 resend_error | resend_unreachable | resend_bad_response
//     504 resend_timeout
//
// Auth model:
//   Service-role only, deployed with the default JWT verification ON. The
//   webhook calls us with the service-role key in the Authorization header
//   (never the user's JWT — there is no user JWT inside mux-webhook).
//
// Failure model:
//   Mirrors mux-create-upload — structured errors, ~10s Resend timeout, no
//   secrets ever in logs (only video id, Resend message id, and status).
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { INSTRUCTOR_ADULT_MESSAGING_APPROVED } from '../_shared/coachingPolicy.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEmailSender, sendResendEmail as sendBrandedEmail } from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

type ErrorCode =
  | "method_not_allowed"
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "not_found"
  | "db_error"
  | "resend_error"
  | "resend_unreachable"
  | "resend_bad_response"
  | "resend_timeout";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(401, "unauthorized", "Service role required");
  }
  if (!INSTRUCTOR_ADULT_MESSAGING_APPROVED) {
    return jsonOk({ ok: true, skipped: "adult_messaging_policy_required" });
  }

  // ---- 2. Parse body ------------------------------------------------------
  let body: { video_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Body is not valid JSON");
  }
  const videoId = typeof body.video_id === "string" ? body.video_id : "";
  if (!videoId) {
    return jsonError(400, "bad_request", "video_id is required");
  }

  // ---- 3. Look up the video + the coach_messages row that carries it -----
  // We need:
  //   - videos.purpose                                    (gate)
  //   - the coach (sender) display name                   -> coaches.first_name via sender_user_id
  //   - the recipient kid first name + family parent_email -> families
  // We resolve through coach_messages because that's the only place that
  // joins a video to a recipient family + kid.
  const { data: video, error: videoErr } = await adminClient
    .from("videos")
    .select("id, purpose, uploaded_by_user_id")
    .eq("id", videoId)
    .maybeSingle();
  if (videoErr) {
    console.error("send-coach-video-notification db_error videos", videoErr);
    return jsonError(500, "db_error", "Failed to look up video");
  }
  if (!video) {
    return jsonError(404, "not_found", "Video not found");
  }
  if (video.purpose !== "coach_message") {
    console.log(
      `send-coach-video-notification video_id=${videoId} skipped=not_a_coach_message ms=${Date.now() - startedAt}`,
    );
    return jsonOk({ ok: true, skipped: "not_a_coach_message" });
  }

  // The latest message carrying this video id. In normal flow there's
  // exactly one (sendCoachMessage inserts once after upload).
  const { data: msg, error: msgErr } = await adminClient
    .from("coach_messages")
    .select(
      "id, recipient_family_id, recipient_kid_id, sender_user_id",
    )
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (msgErr) {
    console.error("send-coach-video-notification db_error coach_messages", msgErr);
    return jsonError(500, "db_error", "Failed to look up coach message");
  }
  if (!msg) {
    // Video is ready but the coach hasn't actually sent it yet (no row in
    // coach_messages). Nothing to email about.
    console.log(
      `send-coach-video-notification video_id=${videoId} skipped=no_message ms=${Date.now() - startedAt}`,
    );
    return jsonOk({ ok: true, skipped: "no_message" });
  }

  const [familyRes, kidRes, coachRes] = await Promise.all([
    adminClient
      .from("families")
      .select("id, parent_email, parent_first_name, parent_user_id, tenant_id, primary_location_id")
      .eq("id", msg.recipient_family_id)
      .maybeSingle(),
    adminClient
      .from("kids")
      .select("id, first_name")
      .eq("id", msg.recipient_kid_id)
      .maybeSingle(),
    adminClient
      .from("coaches")
      .select("first_name")
      .eq("user_id", msg.sender_user_id)
      .maybeSingle(),
  ]);

  if (familyRes.error || kidRes.error || coachRes.error) {
    console.error(
      "send-coach-video-notification db_error joins",
      familyRes.error ?? kidRes.error ?? coachRes.error,
    );
    return jsonError(500, "db_error", "Failed to look up family/kid/coach");
  }

  const family = familyRes.data;
  const kid = kidRes.data;
  const coach = coachRes.data;
  if (!family || !kid) {
    return jsonError(404, "not_found", "Recipient family or kid not found");
  }
  if (!family.parent_email) {
    console.log(
      `send-coach-video-notification video_id=${videoId} skipped=no_parent_email ms=${Date.now() - startedAt}`,
    );
    return jsonOk({ ok: true, skipped: "no_parent_email" });
  }
  if (!RESEND_API_KEY) {
    console.error("send-coach-video-notification missing RESEND_API_KEY");
    return jsonError(502, "resend_error", "Resend not configured");
  }

  let businessName: string | null = null;
  let replyToEmail: string | null = null;
  const [tenantRes, locationRes] = await Promise.all([
    family.tenant_id
      ? adminClient.from("tenants").select("name").eq("id", family.tenant_id).maybeSingle()
      : Promise.resolve({ data: null }),
    family.primary_location_id
      ? adminClient.from("locations").select("email").eq("id", family.primary_location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  businessName = (tenantRes.data as { name: string } | null)?.name ?? null;
  replyToEmail = (locationRes.data as { email: string | null } | null)?.email ?? null;

  // ---- 4. Build + send the email -----------------------------------------
  const coachFirst = coach?.first_name ?? "Your coach";
  const kidFirst = kid.first_name;
  const subject = `Coach ${coachFirst} sent ${kidFirst} a new video`;
  // No per-message deep route exists yet — link to the app root so the OS
  // resolves the universal/custom-scheme link and opens Ballpark.
  // TODO: replace with a deep link to the specific message screen once
  // the parent inbox supports `ballpark://messages/<id>`.
  const deepLink = "ballpark://";

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">New video from Coach ${escapeHtml(coachFirst)}</h1>
      <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px;">
        Hi ${escapeHtml(family.parent_first_name ?? "there")}, Coach ${escapeHtml(coachFirst)} just sent ${escapeHtml(kidFirst)} a new video in Ballpark.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${deepLink}"
           style="display: inline-block; background: #FF6A00; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
          Open in Ballpark
        </a>
      </p>
      <p style="font-size: 12px; color: #666; margin: 0;">
        If the button doesn't work, open Ballpark on your phone — the video is on ${escapeHtml(kidFirst)}'s home screen.
      </p>
    </div>
  `;

  const sender = buildEmailSender({ businessName, replyToEmail });
  const result = await sendBrandedEmail({
    to: family.parent_email,
    subject,
    html,
    text: subject,
    ...sender,
  });

  if (!result.ok) {
    console.error(
      `send-coach-video-notification video_id=${videoId} resend_error: ${result.error}`,
    );
    return jsonError(502, "resend_error", "Failed to send email via Resend");
  }

  console.log(
    `send-coach-video-notification video_id=${videoId} sent=true ms=${Date.now() - startedAt}`,
  );
  return jsonOk({ ok: true });
});
