"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function backToEdit(id: string, error: string): never {
  redirect(
    `/coach/assignments/${id}/edit?error=${encodeURIComponent(error)}`,
  );
}

function backToDetail(id: string, error: string): never {
  redirect(
    `/coach/assignments/${id}?error=${encodeURIComponent(error)}`,
  );
}

export async function updateAssignment(formData: FormData) {
  const id = String(formData.get("assignment_id") ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    redirect("/coach/assignments");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const drillVideoIdRaw = String(formData.get("drill_video_id") ?? "").trim();
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();

  if (!title) backToEdit(id, "Drill title is required.");
  if (title.length > 120) backToEdit(id, "Drill title is too long (max 120).");
  if (!description) backToEdit(id, "Drill description is required.");
  if (drillVideoIdRaw && !UUID_RE.test(drillVideoIdRaw)) {
    backToEdit(id, "Drill video id must be a UUID.");
  }
  if (dueDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw)) {
    backToEdit(id, "Due date must be a calendar date.");
  }

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) backToEdit(id, "Your session expired. Sign in again.");
  if (readAppRole(session) !== "coach") {
    backToEdit(id, "Only coaches can edit assignments.");
  }

  const { error: rpcErr } = await supabase.rpc(
    "update_assignment_for_coach",
    {
      p_assignment_id: id,
      p_title: title,
      p_description: description,
      p_due_date: dueDateRaw || null,
      p_drill_video_id: drillVideoIdRaw || null,
    },
  );

  if (rpcErr) {
    backToEdit(id, `Could not save: ${rpcErr.message}`);
  }

  revalidatePath("/coach/assignments");
  revalidatePath(`/coach/assignments/${id}`);
  redirect(`/coach/assignments/${id}`);
}

export async function cancelAssignment(formData: FormData) {
  const id = String(formData.get("assignment_id") ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    redirect("/coach/assignments");
  }

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) backToDetail(id, "Your session expired. Sign in again.");
  if (readAppRole(session) !== "coach") {
    backToDetail(id, "Only coaches can cancel assignments.");
  }

  const { error: rpcErr } = await supabase.rpc(
    "cancel_assignment_for_coach",
    { p_assignment_id: id },
  );

  if (rpcErr) {
    backToDetail(id, `Could not cancel: ${rpcErr.message}`);
  }

  revalidatePath("/coach/assignments");
  redirect("/coach/assignments");
}
