"use server";
/**
 * Server actions for /admin/redemptions (v0.7 task #122).
 *
 * Both actions delegate to the SECURITY DEFINER RPC
 * `mark_redemption_fulfilled(p_code)` which validates app_role='admin'
 * + tenant on the JWT side. Any error is funneled into ?error= for the
 * page to render in a banner.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { readAppRole, readTenantId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  if (readAppRole(session) !== "admin") redirect("/logout?reason=forbidden");
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");
  return { supabase };
}

async function fulfill(code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    redirect(`/admin/redemptions?error=${encodeURIComponent("Enter a code.")}`);
  }
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("mark_redemption_fulfilled", {
    p_code: trimmed,
  });
  if (error) {
    redirect(
      `/admin/redemptions?error=${encodeURIComponent(error.message ?? "Could not fulfill")}`,
    );
  }
  revalidatePath("/admin/redemptions");
  const fulfilledCode =
    (data as { redemption_code?: string } | null)?.redemption_code ?? trimmed;
  redirect(`/admin/redemptions?ok=${encodeURIComponent(fulfilledCode)}`);
}

export async function fulfillByCode(formData: FormData) {
  const code = (formData.get("code") as string | null) ?? "";
  await fulfill(code);
}

export async function fulfillById(formData: FormData) {
  // Same path — the per-row button submits the redemption_code as `code`.
  const code = (formData.get("code") as string | null) ?? "";
  await fulfill(code);
}
