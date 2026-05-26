"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

async function requireOwnerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  const role = readAppRole(session);
  if (role !== "owner" && role !== "admin") redirect("/logout?reason=forbidden");
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");
  return { supabase, tenantId };
}

/**
 * Update the `capabilities.preset` for a coach row. Only owner/admin may call
 * this. The preset must be "instructor" or "staff" — anything else is rejected.
 */
export async function updateCoachPreset(formData: FormData) {
  const coachId = (formData.get("coachId") as string | null) ?? "";
  const preset = (formData.get("preset") as string | null) ?? "";

  if (!coachId) throw new Error("coachId is required");
  if (preset !== "instructor" && preset !== "staff") {
    throw new Error(`Invalid preset: ${preset}`);
  }

  const { supabase, tenantId } = await requireOwnerOrAdmin();

  const { error } = await supabase
    .from("coaches")
    .update({ capabilities: { preset } })
    .eq("id", coachId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Failed to update preset: ${error.message}`);

  revalidatePath("/owner/coaches");
}
