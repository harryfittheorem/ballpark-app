"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function replyToThread(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const kidId = String(formData.get("kid_id") ?? "").trim();
  const messageText = String(formData.get("message_text") ?? "").trim();

  if (!kidId || !messageText) return { error: "Missing required fields." };

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return { error: "Not authenticated." };

  // Resolve tenant_id directly from the coaches table — more reliable than
  // decoding the JWT custom claim, which may be absent in server action context.
  const { data: coachRow, error: coachErr } = await supabase
    .from("coaches")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (coachErr || !coachRow?.tenant_id) {
    return { error: "Could not resolve your coach profile. Please sign out and back in." };
  }

  const tenantId = coachRow.tenant_id as string;

  const rawName = user.user_metadata?.full_name;
  const senderDisplay =
    (typeof rawName === "string" && rawName.length > 0 ? rawName : undefined) ??
    user.email ??
    "Coach";

  // Resolve family_id from the kid row — required by parent-side RLS SELECT policy
  // (coach_messages_select_parent checks recipient_family_id = family.id).
  const { data: kid, error: kidErr } = await supabase
    .from("kids")
    .select("family_id")
    .eq("id", kidId)
    .maybeSingle();

  if (kidErr || !kid?.family_id) {
    return { error: "Could not find the athlete. Please refresh and try again." };
  }

  const { error: insertErr } = await supabase.from("coach_messages").insert({
    sender_user_id: user.id,
    sender_display: senderDisplay,
    recipient_kid_id: kidId,
    recipient_family_id: kid.family_id,
    message_text: messageText,
    video_id: null,
    label: null,
    tenant_id: tenantId,
  });

  if (insertErr) {
    return { error: `Failed to send message: ${insertErr.message}` };
  }

  revalidatePath("/coach/inbox");
  revalidatePath(`/coach/inbox/${kidId}`);
}
