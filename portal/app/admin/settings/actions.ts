"use server";
/**
 * Admin server actions for tenant settings (task #185).
 *
 * RLS pins tenant_id and restricts writes to app_role IN ('admin','owner').
 * These actions add explicit server-side authz (requireAdmin), input
 * sanitisation, and fail-loud error paths consistent with other admin actions.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  const role = readAppRole(session);
  if (role !== "admin" && role !== "owner") {
    redirect("/logout?reason=forbidden");
  }
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");
  return { supabase, tenantId };
}

export async function saveFacilityId(formData: FormData) {
  const { supabase, tenantId } = await requireAdmin();

  const raw = formData.get("hittrax_facility_id");
  const value = typeof raw === "string" ? raw.trim() : "";

  const { error } = await supabase
    .from("tenants")
    .update({ hittrax_facility_id: value || null })
    .eq("id", tenantId);

  if (error) {
    redirect(
      `/admin/settings?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
