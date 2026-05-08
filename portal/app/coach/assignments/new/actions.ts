"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function backToForm(error: string): never {
  redirect(`/coach/assignments/new?error=${encodeURIComponent(error)}`);
}

export async function createAssignment(formData: FormData) {
  const kidId = String(formData.get("kid_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const drillVideoIdRaw = String(formData.get("drill_video_id") ?? "").trim();
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();

  // Hand-rolled validation (no zod dep — keep portal/package.json minimal).
  if (!kidId || !UUID_RE.test(kidId)) {
    backToForm("Pick a kid for this assignment.");
  }
  if (!title) backToForm("Drill title is required.");
  if (title.length > 120) backToForm("Drill title is too long (max 120).");
  if (!description) backToForm("Drill description is required.");
  if (drillVideoIdRaw && !UUID_RE.test(drillVideoIdRaw)) {
    backToForm("Drill video id must be a UUID.");
  }
  // Due date is either '' or YYYY-MM-DD (the native date input enforces shape).
  if (dueDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw)) {
    backToForm("Due date must be a calendar date.");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) backToForm("Your session expired. Sign in again.");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (readAppRole(session) !== "coach") {
    backToForm("Only coaches can create assignments.");
  }
  const tenantId = readTenantId(session);
  if (!tenantId) {
    backToForm("Your account is missing a tenant claim. Contact support.");
  }

  // Look up family_id for the chosen kid. RLS scopes this to the coach's
  // tenant so a stale/forged kid_id from another tenant returns no rows.
  const { data: kid, error: kidErr } = await supabase
    .from("kids")
    .select("family_id")
    .eq("id", kidId)
    .single();

  if (kidErr || !kid) {
    backToForm("That kid is not in your tenant.");
  }

  // Defence-in-depth: if a drill_video_id was submitted, confirm it belongs
  // to this coach. Form tampering or a stale UUID from another coach would
  // otherwise be accepted by the assignments INSERT (videos.id has no
  // FK-level uploader check).
  if (drillVideoIdRaw) {
    const { data: video, error: vidErr } = await supabase
      .from("videos")
      .select("id")
      .eq("id", drillVideoIdRaw)
      .eq("uploaded_by_user_id", user!.id)
      .maybeSingle();
    if (vidErr || !video) {
      backToForm("That drill video isn\u2019t one of yours.");
    }
  }

  const insert: Record<string, unknown> = {
    tenant_id: tenantId,
    kid_id: kidId,
    family_id: kid.family_id,
    coach_user_id: user!.id,
    title,
    description,
  };
  // Only set drill_video_id when the coach actually picked one — let the
  // column default to NULL otherwise.
  if (drillVideoIdRaw) insert.drill_video_id = drillVideoIdRaw;
  if (dueDateRaw) insert.due_date = dueDateRaw;

  const { error: insErr } = await supabase
    .from("assignments")
    .insert(insert);

  if (insErr) {
    backToForm(`Could not save: ${insErr.message}`);
  }

  revalidatePath("/coach/assignments");
  redirect("/coach/assignments");
}
