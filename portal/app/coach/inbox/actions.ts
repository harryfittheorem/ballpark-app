"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readTenantId } from "@/lib/auth";

export async function replyToThread(formData: FormData) {
  const kidId = String(formData.get("kid_id") ?? "").trim();
  const messageText = String(formData.get("message_text") ?? "").trim();

  if (!kidId || !messageText) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) return;

  const tenantId = readTenantId(session);
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

  if (kidErr || !kid?.family_id) return;

  await supabase.from("coach_messages").insert({
    sender_user_id: user.id,
    sender_display: senderDisplay,
    recipient_kid_id: kidId,
    recipient_family_id: kid.family_id,
    message_text: messageText,
    video_id: null,
    label: null,
    tenant_id: tenantId,
  });

  revalidatePath("/coach/inbox");
  revalidatePath(`/coach/inbox/${kidId}`);
}
