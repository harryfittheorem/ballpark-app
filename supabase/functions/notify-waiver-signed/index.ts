// =============================================================================
// supabase/functions/notify-waiver-signed/index.ts
// =============================================================================
// Task #250 — Waiver signed email
//
// Sends a Resend email to the parent with a copy of the signed waiver,
// providing a legal paper trail of the digital consent.
//
// Called via pg_net trigger on family_waivers INSERT.
//
// Can also be invoked manually for testing:
//   curl -X POST \
//     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"family_waiver_id":"<uuid>"}' \
//     https://<project>.supabase.co/functions/v1/notify-waiver-signed
//
// Auth: service-role Bearer required.
// Returns HTTP 200 regardless of email outcome (best-effort delivery).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY           = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL        = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${hh}:${mm} UTC`;
}

// Convert newlines in waiver body text to <br> tags for HTML rendering
function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n\n/g, "</p><p style=\"margin:0 0 12px;font-size:12px;color:#a0967e;line-height:1.7;\">")
    .replace(/\n/g, "<br>");
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[notify-waiver-signed] RESEND_API_KEY not set — skipping email");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
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
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[notify-waiver-signed] Resend error ${res.status}: ${body.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  // Service-role gate
  const authHeader  = req.headers.get("Authorization") ?? "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken || callerToken !== SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Service-role token required" }, 401);
  }

  let body: { family_waiver_id?: string };
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { family_waiver_id } = body;
  if (!family_waiver_id) {
    return json({ error: "family_waiver_id required" }, 422);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: fw, error: fwErr } = await supabase
    .from("family_waivers")
    .select(`
      id, signed_at, app_version,
      waivers!inner(body_text),
      families!inner(parent_email, parent_first_name)
    `)
    .eq("id", family_waiver_id)
    .maybeSingle();

  if (fwErr) {
    console.error("[notify-waiver-signed] DB error:", fwErr.message);
    return json({ ok: true, skipped: "db_error" });
  }
  if (!fw) {
    console.warn("[notify-waiver-signed] family_waiver not found:", family_waiver_id);
    return json({ ok: true, skipped: "not_found" });
  }

  const fam     = fw.families as unknown as { parent_email: string; parent_first_name: string };
  const waiver  = fw.waivers  as unknown as { body_text: string };

  const parentEmail  = fam.parent_email;
  const parentFirst  = fam.parent_first_name ?? "there";
  const signedAt     = formatDateTime(fw.signed_at as string);
  const waiverBody   = textToHtml(waiver.body_text ?? "");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#1a1a1a;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#cfab56;padding:20px 28px;">
            <span style="font-size:18px;font-weight:800;color:#1a1a1a;letter-spacing:0.5px;">
              ⚾ Ballpark
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 20px;">
            <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#f5f0e8;">
              Hi ${parentFirst},
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#a0967e;line-height:1.6;">
              This email confirms you have signed the Ballpark Liability Waiver.
              A copy of the signed waiver is included below for your records.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#252525;border-radius:8px;margin:0 0 20px;">
              <tr>
                <td style="padding:14px 18px;">
                  <span style="font-size:11px;color:#6b6354;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                    SIGNED
                  </span><br>
                  <span style="font-size:13px;font-weight:700;color:#cfab56;">
                    ${signedAt}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 8px;">
            <div style="border-top:1px solid #2e2a25;padding-top:20px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#6b6354;letter-spacing:1px;text-transform:uppercase;">
                WAIVER TEXT
              </p>
              <p style="margin:0 0 12px;font-size:12px;color:#a0967e;line-height:1.7;">${waiverBody}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 28px;">
            <p style="margin:0;font-size:11px;color:#4a4438;border-top:1px solid #2e2a25;padding-top:16px;">
              This is a copy of the waiver you signed electronically in the Ballpark app.
              Please keep this email for your records.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendResendEmail({
    to: parentEmail,
    subject: "Your Ballpark Liability Waiver — signed copy",
    html,
  });

  console.log(`[notify-waiver-signed] email sent to ${parentEmail} for family_waiver ${family_waiver_id}`);
  return json({ ok: true });
});
