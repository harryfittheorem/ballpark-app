"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewFormState = { error: string | null };

export async function reviewAssignment(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "").trim();
  const feedbackRaw = String(formData.get("feedback") ?? "");

  if (!assignmentId || !UUID_RE.test(assignmentId)) {
    return { error: "Invalid assignment id." };
  }

  const ratingNum = Number.parseInt(ratingRaw, 10);
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return { error: "Pick a star rating from 1 to 5." };
  }

  const feedback = feedbackRaw.trim();
  if (feedback.length < 10) {
    return { error: "Feedback must be at least 10 characters." };
  }
  if (feedback.length > 2000) {
    return { error: "Feedback must be 2000 characters or fewer." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Sign in again." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (readAppRole(session) !== "coach") {
    return { error: "Only coaches can review assignments." };
  }

  const { error: rpcErr } = await supabase.rpc("review_assignment", {
    p_assignment_id: assignmentId,
    p_rating: ratingNum,
    p_feedback: feedback,
  });

  if (rpcErr) {
    return { error: rpcErr.message };
  }

  revalidatePath("/coach/assignments");
  revalidatePath(`/coach/assignments/${assignmentId}`);
  return { error: null };
}
