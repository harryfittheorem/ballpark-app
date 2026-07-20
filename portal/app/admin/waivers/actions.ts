"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildEmailSender, sendResendEmail } from "@/lib/email";
import { readAppRole, readTenantId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";

/**
 * Publish a new waiver version.
 *
 * Atomicity guarantee:
 *   The actual deactivate+insert work is delegated to the
 *   `publish_waiver_version` PL/pgSQL function, which runs both steps inside
 *   a single DB transaction.  This means the unique partial index
 *   idx_waivers_one_active_per_tenant is never violated and the tenant is
 *   never left with zero active waivers — even under transient failures.
 */
export async function publishNewWaiverVersion(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; version?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  if (readAppRole(session) !== "admin") redirect("/logout?reason=forbidden");

  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const bodyText = (formData.get("body_text") as string | null)?.trim();
  const effectiveDate =
    (formData.get("effective_date") as string | null) ||
    new Date().toISOString().slice(0, 10);

  if (!bodyText) {
    return { error: "Contract text cannot be empty." };
  }

  const svc = createServiceClient();

  const { data, error } = await svc.rpc("publish_waiver_version", {
    p_tenant_id: tenantId,
    p_body_text: bodyText,
    p_effective_date: effectiveDate,
  });

  if (error) return { error: error.message };

  const newVersion = (data as Array<{ new_version: number }>)?.[0]?.new_version;

  revalidatePath("/admin/waivers");
  return { ok: true, version: newVersion };
}

/**
 * Send a waiver-reminder email to a family.
 *
 * The email body includes:
 *   - A Ballpark deep-link (ballpark:///) that opens the app directly.
 *   - App store fallback instructions for families without the app.
 */
export async function sendWaiverReminder(
  familyId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthenticated" };
  if (readAppRole(session) !== "admin") return { error: "Forbidden" };

  const tenantId = readTenantId(session);
  if (!tenantId) return { error: "No tenant" };

  const svc = createServiceClient();

  const { data: family } = await svc
    .from("families")
    .select("parent_first_name, parent_email")
    .eq("id", familyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!family?.parent_email) {
    return { error: "No email on file for this family." };
  }

  const { data: tenant } = await svc
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  const businessName = (tenant?.name as string | null) ?? "Ballpark";

  // Deep link that opens the Ballpark app on iOS and Android.
  // The app routes unsigned/outdated families to the waiver prompt from the home screen.
  const deepLink = "ballpark:///";

  const { from } = buildEmailSender({ businessName });

  const textBody = [
    `Hi ${family.parent_first_name},`,
    ``,
    `Your membership agreement with ${businessName} needs your signature before you can book sessions.`,
    ``,
    `Open the Ballpark app to review and sign:`,
    `  ${deepLink}`,
    ``,
    `Don't have the app yet? Search "Ballpark" on the App Store or Google Play, then sign in with this email address.`,
    ``,
    `If you have any questions, just reply to this email.`,
    ``,
    `Thank you,`,
    businessName,
  ].join("\n");

  const htmlBody = `
<p>Hi ${family.parent_first_name},</p>
<p>Your membership agreement with <strong>${businessName}</strong> needs your signature before you can book sessions.</p>
<p style="margin:24px 0;">
  <a href="${deepLink}"
     style="display:inline-block;background:#C9A84C;color:#0F1A14;font-weight:700;font-size:15px;
            padding:12px 28px;border-radius:8px;text-decoration:none;">
    Sign your membership agreement
  </a>
</p>
<p style="font-size:13px;color:#666;">
  The button above opens the Ballpark app directly.
  If it doesn't work, open the app manually — the agreement prompt will appear on your home screen.
  Don't have the app yet? Search <strong>Ballpark</strong> on the App Store or Google Play
  and sign in with this email address.
</p>
<p>If you have any questions, just reply to this email.</p>
<p>Thank you,<br/>${businessName}</p>
`;

  return sendResendEmail({
    to: family.parent_email,
    from,
    subject: `Action required: Sign your membership agreement`,
    text: textBody,
    html: htmlBody,
  });
}
