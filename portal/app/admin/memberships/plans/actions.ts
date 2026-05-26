"use server";

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
  if (!["admin", "owner"].includes(readAppRole(session))) {
    redirect("/logout?reason=forbidden");
  }
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");
  return { supabase, tenantId };
}

function parseCents(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^\$/, "");
  if (trimmed === "") return null;
  const dollars = parseFloat(trimmed);
  if (isNaN(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export async function createMembershipPlan(formData: FormData) {
  const { supabase, tenantId } = await requireAdmin();

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const planType = formData.get("plan_type") as string | null;
  const priceRaw = formData.get("amount_dollars") as string | null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const sortOrderRaw = (formData.get("sort_order") as string | null)?.trim();

  const BASE = "/admin/memberships/plans";

  if (!name) redirect(`${BASE}?error=Name+is+required`);
  if (planType !== "eft" && planType !== "otc") {
    redirect(`${BASE}?error=Invalid+plan+type`);
  }
  const amountCents = parseCents(priceRaw);
  if (amountCents === null) {
    redirect(`${BASE}?error=Price+must+be+a+valid+dollar+amount+(e.g.+149.00)`);
  }

  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;
  if (isNaN(sortOrder)) {
    redirect(`${BASE}?error=Sort+order+must+be+a+whole+number`);
  }

  const { error } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("membership_plans")
    .insert({
      tenant_id: tenantId,
      name,
      plan_type: planType,
      amount_cents: amountCents,
      description,
      sort_order: sortOrder,
      is_active: true,
    });

  if (error) {
    redirect(
      `${BASE}?error=${encodeURIComponent("DB error: " + error.message)}`,
    );
  }

  revalidatePath(BASE);
  redirect(`${BASE}?ok=created`);
}

export async function updateMembershipPlan(formData: FormData) {
  const { supabase, tenantId } = await requireAdmin();

  const id = (formData.get("id") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const planType = formData.get("plan_type") as string | null;
  const priceRaw = formData.get("amount_dollars") as string | null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const sortOrderRaw = (formData.get("sort_order") as string | null)?.trim();

  const BASE = "/admin/memberships/plans";

  if (!id) redirect(`${BASE}?error=Missing+plan+ID`);
  if (!name) redirect(`${BASE}/${id}/edit?error=Name+is+required`);
  if (planType !== "eft" && planType !== "otc") {
    redirect(`${BASE}/${id}/edit?error=Invalid+plan+type`);
  }
  const amountCents = parseCents(priceRaw);
  if (amountCents === null) {
    redirect(`${BASE}/${id}/edit?error=Price+must+be+a+valid+dollar+amount+(e.g.+149.00)`);
  }

  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;
  if (isNaN(sortOrder)) {
    redirect(`${BASE}/${id}/edit?error=Sort+order+must+be+a+whole+number`);
  }

  const { error } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("membership_plans")
    .update({
      name,
      plan_type: planType,
      amount_cents: amountCents,
      description,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    redirect(
      `${BASE}/${id}/edit?error=${encodeURIComponent("DB error: " + error.message)}`,
    );
  }

  revalidatePath(BASE);
  redirect(`${BASE}?ok=updated`);
}

export async function toggleMembershipPlan(formData: FormData) {
  const { supabase, tenantId } = await requireAdmin();

  const id = formData.get("id") as string | null;
  const isActiveStr = formData.get("is_active") as string | null;

  const BASE = "/admin/memberships/plans";

  if (!id || isActiveStr === null) {
    redirect(`${BASE}?error=Missing+parameters`);
  }

  const isActive = isActiveStr === "true";

  const { error } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("membership_plans")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    redirect(
      `${BASE}?error=${encodeURIComponent("DB error: " + error.message)}`,
    );
  }

  revalidatePath(BASE);
  redirect(`${BASE}?ok=updated`);
}
