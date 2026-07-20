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
 * Atomic ordering guarantee:
 *   1. INSERT the new row (is_active = true) first.
 *   2. Only if insert succeeds, deactivate all other rows.
 *
 * This means the tenant is NEVER left with zero active waivers.  The worst
 * transient state is two active rows (new + old) for a few milliseconds,
 * which client code handles by taking the highest version.
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

  const { data: maxRow } = await svc
    .from("waivers")
    .select("version")
    .eq("tenant_id", tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version ?? 0) + 1;

  // Step 1: insert the new version first.
  const { data: inserted, error: insertError } = await svc
    .from("waivers")
    .insert({
      tenant_id: tenantId,
      version: nextVersion,
      body_text: bodyText,
      effective_date: effectiveDate,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    return { error: insertError?.message ?? "Failed to insert new waiver version." };
  }

  // Step 2: deactivate all other rows now that the new one is live.
  const { error: deactivateError } = await svc
    .from("waivers")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .neq("id", inserted.id);

  if (deactivateError) {
    // Non-fatal — the new version is already active. Log the inconsistency
    // but do not roll back; having two "active" rows is recoverable, zero is not.
    console.error(
      "[publishNewWaiverVersion] failed to deactivate old rows:",
      deactivateError.message,
    );
  }

  revalidatePath("/admin/waivers");
  return { ok: true, version: nextVersion };
}

/**
 * Send a waiver-reminder email to a family.
 *
 * The email body includes:
 *   - A Ballpark deep-link (ballpark:///) so iOS/Android opens the app directly.
 *   - A fallback note for families who haven't installed the app yet.
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

  // Deep link that opens the app.  iOS and Android will route it to the waiver
  // prompt on the Me tab if the family is unsigned/outdated.
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
  If it doesn't work, open the app manually and look for the agreement prompt on the home screen.
  Don't have the app yet? Search <strong>Ballpark</strong> on the App Store or Google Play,
  then sign in with this email address.
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
