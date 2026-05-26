"use server";
/**
 * Server actions for /coach/redemptions — staff coach fulfillment surface.
 *
 * Authorization is enforced at the DB layer by mark_redemption_fulfilled_staff():
 *   • app_role must be 'coach'
 *   • coaches.capabilities->>'preset' must be 'staff'
 *   • order tenant_id must match the caller's JWT tenant_id
 *   • payment_method must be 'points' and status must be 'ordered'
 *
 * The server action pre-checks role/preset to give a meaningful redirect
 * instead of a raw DB exception, but the RPC is the authoritative gate.
 * No service-role client is used — the session client + SECURITY DEFINER RPC
 * is the only path for mutations here.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, getCoachCapabilities, isStaffPreset } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireStaffCoachClient(): Promise<SupabaseClient> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=unauthenticated");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  if (readAppRole(session) !== "coach") redirect("/logout?reason=forbidden");

  const caps = await getCoachCapabilities(supabase, user.id);
  if (!isStaffPreset(caps)) redirect("/coach");

  // Return the typed-as-any cast so we can call the new RPC
  // (mark_redemption_fulfilled_staff not yet in generated types)
  return supabase as unknown as SupabaseClient;
}

async function fulfill(code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    redirect(`/coach/redemptions?error=${encodeURIComponent("Enter a code.")}`);
  }

  const supabase = await requireStaffCoachClient();

  // DB-enforced SECURITY DEFINER RPC handles all authorization and fulfillment.
  // It validates coach role, staff preset, tenant match, payment_method='points',
  // status='ordered', and is idempotent on already-fulfilled orders.
  const { data, error } = await (supabase as SupabaseClient).rpc(
    "mark_redemption_fulfilled_staff",
    { p_code: trimmed },
  );

  if (error) {
    const msg = (error as { message?: string }).message ?? "Could not fulfill";
    redirect(`/coach/redemptions?error=${encodeURIComponent(msg)}`);
  }

  const redemptionCode =
    (data as { redemption_code?: string } | null)?.redemption_code ?? trimmed;
  revalidatePath("/coach/redemptions");
  redirect(`/coach/redemptions?ok=${encodeURIComponent(redemptionCode)}`);
}

export async function fulfillByCode(formData: FormData) {
  const code = (formData.get("code") as string | null) ?? "";
  await fulfill(code);
}

export async function fulfillById(formData: FormData) {
  const code = (formData.get("code") as string | null) ?? "";
  await fulfill(code);
}
