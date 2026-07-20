"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildEmailSender, sendResendEmail } from "@/lib/email";
import { readAppRole, readTenantId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";

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

  await svc
    .from("waivers")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const { error } = await svc.from("waivers").insert({
    tenant_id: tenantId,
    version: nextVersion,
    body_text: bodyText,
    effective_date: effectiveDate,
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/waivers");
  return { ok: true, version: nextVersion };
}

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
  const { from } = buildEmailSender({ businessName });

  return sendResendEmail({
    to: family.parent_email,
    from,
    subject: `Action required: Please sign your membership agreement`,
    text: [
      `Hi ${family.parent_first_name},`,
      ``,
      `We need you to sign your membership agreement. Please open the ${businessName} app and follow the prompts to review and sign.`,
      ``,
      `If you have any questions, feel free to reply to this email.`,
      ``,
      `Thank you,`,
      businessName,
    ].join("\n"),
    html: `<p>Hi ${family.parent_first_name},</p><p>We need you to sign your membership agreement. Please open the <strong>${businessName}</strong> app and follow the prompts to review and sign.</p><p>If you have any questions, feel free to reply to this email.</p><p>Thank you,<br/>${businessName}</p>`,
  });
}
