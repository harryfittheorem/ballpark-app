"use server";
/**
 * Server actions for the coach location assignment page.
 *
 * Reads/writes coach_locations (junction table).
 * RLS requires app_role IN ('owner','admin') with tenant scope.
 *
 * AUTHORIZATION MODEL:
 *   owner  — can assign/remove any coach to any location in their tenant.
 *   admin  — can only assign/remove coaches to locations they are themselves
 *            assigned to (staff_locations table). Any location ID not in
 *            their staff_locations is rejected server-side, regardless of
 *            what the UI shows.
 *
 * CROSS-TENANT PROTECTION:
 *   Both the coach and the location are verified to belong to tenantId before
 *   any write to coach_locations. This prevents a crafted request from binding
 *   a coach UUID from another tenant to a valid location.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

type RequireAdminResult = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  role: string;
  userId: string;
};

async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  const role = readAppRole(session);
  if (role !== "admin" && role !== "owner") redirect("/logout?reason=forbidden");
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");
  return { supabase, tenantId, role, userId: session.user.id };
}

/**
 * Verify the coach exists and belongs to the caller's tenant.
 * This is the primary cross-tenant guard: an admin cannot pair a coach UUID
 * from another tenant with their location even if they know the value.
 */
async function authorizeCoach(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  tenantId: string,
): Promise<void> {
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("id", coachId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!coach) {
    redirect(
      `/admin/coaches/${coachId}/locations?error=${encodeURIComponent(
        "Coach not found or not in your organisation.",
      )}`,
    );
  }
}

/**
 * Verify the location belongs to the tenant AND (for admin role) is one of
 * the caller's staff_locations assignments. Redirects with an error on failure.
 */
async function authorizeLocation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  locationId: string,
  tenantId: string,
  role: string,
  userId: string,
): Promise<void> {
  // All roles: verify location belongs to this tenant.
  const { data: loc } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!loc) {
    redirect(
      `/admin/coaches/${coachId}/locations?error=${encodeURIComponent("Location not found.")}`,
    );
  }

  // Admin only: additionally verify the location is in their staff_locations.
  // Owners have tenant-wide access and skip this check.
  if (role === "admin") {
    const { data: staffLoc } = await supabase
      .from("staff_locations")
      .select("location_id")
      .eq("user_id", userId)
      .eq("location_id", locationId)
      .maybeSingle();

    if (!staffLoc) {
      redirect(
        `/admin/coaches/${coachId}/locations?error=${encodeURIComponent(
          "You are not authorized to manage this location.",
        )}`,
      );
    }
  }
}

export async function assignCoachToLocation(formData: FormData) {
  const { supabase, tenantId, role, userId } = await requireAdmin();

  const coachId = String(formData.get("coach_id") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "").trim();

  if (!coachId || !locationId) {
    redirect(
      `/admin/coaches/${coachId}/locations?error=${encodeURIComponent("Missing coach or location.")}`,
    );
  }

  // Verify both coach and location belong to this tenant before any write.
  await authorizeCoach(supabase, coachId, tenantId);
  await authorizeLocation(supabase, coachId, locationId, tenantId, role, userId);

  const { error } = await supabase.from("coach_locations").upsert(
    { coach_id: coachId, location_id: locationId, is_primary: false },
    { onConflict: "coach_id,location_id", ignoreDuplicates: true },
  );

  if (error) {
    redirect(
      `/admin/coaches/${coachId}/locations?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/admin/coaches/${coachId}/locations`);
  redirect(`/admin/coaches/${coachId}/locations?saved=1`);
}

export async function removeCoachFromLocation(formData: FormData) {
  const { supabase, tenantId, role, userId } = await requireAdmin();

  const coachId = String(formData.get("coach_id") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "").trim();

  if (!coachId || !locationId) {
    redirect(
      `/admin/coaches/${coachId}/locations?error=${encodeURIComponent("Missing coach or location.")}`,
    );
  }

  // Verify both coach and location belong to this tenant before any write.
  await authorizeCoach(supabase, coachId, tenantId);
  await authorizeLocation(supabase, coachId, locationId, tenantId, role, userId);

  const { error } = await supabase
    .from("coach_locations")
    .delete()
    .eq("coach_id", coachId)
    .eq("location_id", locationId);

  if (error) {
    redirect(
      `/admin/coaches/${coachId}/locations?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/admin/coaches/${coachId}/locations`);
  redirect(`/admin/coaches/${coachId}/locations?removed=1`);
}
