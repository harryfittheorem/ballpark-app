// =============================================================================
// supabase/functions/notify-cancel-requested/index.ts
// =============================================================================
// Task #261 — Cancellation emails
//
// Sends a Resend email to the parent confirming their cancellation request
// and stating the effective date the membership access will end.
//
// Called via pg_net trigger on memberships.cancel_requested_at:
//   AFTER UPDATE OF cancel_requested_at ON memberships
//   WHEN (OLD.cancel_requested_at IS NULL AND NEW.cancel_requested_at IS NOT NULL)
//
// Can also be invoked manually for testing:
//   curl -X POST \
//     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"membership_id":"<uuid>"}' \
//     https://<project>.supabase.co/functions/v1/notify-cancel-requested
//
// Auth: service-role Bearer required.
// Returns HTTP 200 regardless of email outcome (best-effort delivery).
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEmailSender, sendResendEmail as sendBrandedEmail } from '../_shared/email.ts';

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY          = Deno.env.get("RESEND_API_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  businessName?: string | null;
  replyToEmail?: string | null;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[notify-cancel-requested] RESEND_API_KEY not set — skipping email");
    return;
  }
  const sender = buildEmailSender({ businessName: opts.businessName, replyToEmail: opts.replyToEmail });
  const result = await sendBrandedEmail({
    to: opts.to,
    subject: opts.subject,
    text: opts.subject,
    html: opts.html,
    ...sender,
  });
  if (!result.ok) {
    console.error(`[notify-cancel-requested] Resend error: ${result.error}`);
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

  let body: { membership_id?: string };
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { membership_id } = body;
  if (!membership_id) {
    return json({ error: "membership_id required" }, 422);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select(`
      id, plan_name, cancel_requested_at, cancel_effective_at, tenant_id,
      families!inner(parent_email, parent_first_name, primary_location_id)
    `)
    .eq("id", membership_id)
    .maybeSingle();

  if (memErr) {
    console.error("[notify-cancel-requested] DB error:", memErr.message);
    return json({ ok: true, skipped: "db_error" });
  }
  if (!mem) {
    console.warn("[notify-cancel-requested] membership not found:", membership_id);
    return json({ ok: true, skipped: "not_found" });
  }

  const fam = mem.families as unknown as { parent_email: string; parent_first_name: string; primary_location_id: string | null };

  let businessName: string | null = null;
  let replyToEmail: string | null = null;
  if (mem.tenant_id) {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", mem.tenant_id as string).maybeSingle();
    businessName = (tenant as { name?: string } | null)?.name ?? null;
  }
  if (fam.primary_location_id) {
    const { data: loc } = await supabase.from("locations").select("email").eq("id", fam.primary_location_id).maybeSingle();
    replyToEmail = (loc as { email?: string | null } | null)?.email ?? null;
  }

  const parentEmail    = fam.parent_email;
  const parentFirst    = fam.parent_first_name ?? "there";
  const planName       = mem.plan_name ?? "your membership";
  const requestedDate  = formatDate(mem.cancel_requested_at as string | null);
  const effectiveDate  = formatDate(mem.cancel_effective_at as string | null);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#1a1a1a;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:#cfab56;padding:20px 28px;">
            <span style="font-size:18px;font-weight:800;color:#1a1a1a;letter-spacing:0.5px;">
              ⚾ Ballpark
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 0;">
            <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#f5f0e8;">
              Hi ${parentFirst},
            </p>
            <p style="margin:0 0 16px;font-size:14px;color:#a0967e;line-height:1.6;">
              We've received your cancellation request for <strong style="color:#f5f0e8;">${planName}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#252525;border-radius:8px;margin:0 0 20px;">
              <tr>
                <td style="padding:16px 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:12px;color:#6b6354;padding-bottom:8px;">REQUESTED ON</td>
                      <td align="right" style="font-size:12px;font-weight:700;color:#f5f0e8;padding-bottom:8px;">${requestedDate}</td>
                    </tr>
                    <tr>
                      <td style="font-size:12px;color:#6b6354;">ACCESS ENDS</td>
                      <td align="right" style="font-size:12px;font-weight:700;color:#cfab56;">${effectiveDate}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-size:13px;color:#a0967e;line-height:1.6;">
              Your athlete will continue to have full access to all booked sessions and
              facilities until <strong style="color:#f5f0e8;">${effectiveDate}</strong>.
              No further billing charges will occur after that date.
            </p>
            <p style="margin:0 0 28px;font-size:13px;color:#a0967e;line-height:1.6;">
              If you change your mind before then, contact the facility and we can pause
              or reinstate your membership.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 28px;">
            <p style="margin:0;font-size:11px;color:#4a4438;">
              This is a confirmation of your cancellation request. No action is required.
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
    subject: `Your ${planName} cancellation is confirmed — access ends ${effectiveDate}`,
    html,
    businessName,
    replyToEmail,
  });

  console.log(`[notify-cancel-requested] email sent to ${parentEmail} for membership ${membership_id}`);
  return json({ ok: true });
});
