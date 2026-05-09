"use server";
/**
 * Admin server actions for the training video catalog (v0.7 task #121).
 *
 * RLS already pins tenant_id and admin-only writes — these actions are
 * a thin wrapper that adds form validation, a friendly error path, and
 * `revalidatePath` for the index page.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

const CATEGORIES = ["hitting", "mental", "situational", "fielding"] as const;
const LEVELS = ["beginner", "intermediate", "advanced"] as const;

type Category = (typeof CATEGORIES)[number];
type Level = (typeof LEVELS)[number];

function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}
function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as readonly string[]).includes(v);
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  if (readAppRole(session) !== "admin") {
    redirect("/logout?reason=forbidden");
  }
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");
  return { supabase, tenantId };
}

export async function createTrainingVideo(formData: FormData) {
  const { supabase, tenantId } = await requireAdmin();

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const description = ((formData.get("description") as string | null) ?? "").trim();
  const category = formData.get("category");
  const level = formData.get("level") ?? "beginner";
  const coachName = ((formData.get("coach_name") as string | null) ?? "").trim();
  const durationRaw = (formData.get("duration_sec") as string | null) ?? "";
  const featured = formData.get("featured") === "on";
  const publishNow = formData.get("publish_now") === "on";

  let muxPlaybackId = ((formData.get("mux_playback_id") as string | null) ?? "").trim();
  const videoId = ((formData.get("video_id") as string | null) ?? "").trim();

  if (!title) {
    redirect("/admin/training-videos/new?error=title_required");
  }
  if (!isCategory(category)) {
    redirect("/admin/training-videos/new?error=category_required");
  }
  const lvl: Level = isLevel(level) ? level : "beginner";

  // Resolve mux_playback_id from a videos row if the admin uploaded
  // through the form (rather than pasting a known playback id).
  if (!muxPlaybackId && videoId) {
    const { data: vrow } = await supabase
      .from("videos")
      .select("mux_playback_id, status")
      .eq("id", videoId)
      .maybeSingle();
    if (vrow?.mux_playback_id) {
      muxPlaybackId = vrow.mux_playback_id;
    } else {
      redirect(
        "/admin/training-videos/new?error=video_not_ready_or_inaccessible",
      );
    }
  }
  if (!muxPlaybackId) {
    redirect("/admin/training-videos/new?error=playback_id_missing");
  }

  const durationSec = durationRaw ? Math.max(0, Math.floor(Number(durationRaw))) : null;

  const { error } = await supabase.from("training_videos").insert({
    tenant_id: tenantId,
    mux_playback_id: muxPlaybackId,
    title,
    description: description || null,
    category,
    level: lvl,
    coach_name: coachName || null,
    duration_sec: Number.isFinite(durationSec ?? NaN) ? durationSec : null,
    featured,
    published_at: publishNow ? new Date().toISOString() : null,
  });

  if (error) {
    redirect(
      `/admin/training-videos/new?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/admin/training-videos");
  redirect("/admin/training-videos");
}

export async function updateTrainingVideo(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = ((formData.get("id") as string | null) ?? "").trim();
  if (!id) redirect("/admin/training-videos?error=missing_id");

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const description = ((formData.get("description") as string | null) ?? "").trim();
  const category = formData.get("category");
  const level = formData.get("level") ?? "beginner";
  const coachName = ((formData.get("coach_name") as string | null) ?? "").trim();
  const durationRaw = (formData.get("duration_sec") as string | null) ?? "";

  let muxPlaybackId = ((formData.get("mux_playback_id") as string | null) ?? "").trim();
  const videoId = ((formData.get("video_id") as string | null) ?? "").trim();

  if (!title) redirect(`/admin/training-videos/${id}/edit?error=title_required`);
  if (!isCategory(category)) {
    redirect(`/admin/training-videos/${id}/edit?error=category_required`);
  }
  const lvl: Level = isLevel(level) ? level : "beginner";

  if (!muxPlaybackId && videoId) {
    const { data: vrow } = await supabase
      .from("videos")
      .select("mux_playback_id")
      .eq("id", videoId)
      .maybeSingle();
    if (vrow?.mux_playback_id) {
      muxPlaybackId = vrow.mux_playback_id;
    } else {
      redirect(
        `/admin/training-videos/${id}/edit?error=video_not_ready_or_inaccessible`,
      );
    }
  }
  if (!muxPlaybackId) {
    redirect(`/admin/training-videos/${id}/edit?error=playback_id_missing`);
  }

  const durationSec = durationRaw ? Math.max(0, Math.floor(Number(durationRaw))) : null;

  const { error } = await supabase
    .from("training_videos")
    .update({
      mux_playback_id: muxPlaybackId,
      title,
      description: description || null,
      category,
      level: lvl,
      coach_name: coachName || null,
      duration_sec: Number.isFinite(durationSec ?? NaN) ? durationSec : null,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/admin/training-videos/${id}/edit?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/admin/training-videos");
  revalidatePath(`/admin/training-videos/${id}/edit`);
  redirect("/admin/training-videos");
}

export async function togglePublishTrainingVideo(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = (formData.get("id") as string | null) ?? "";
  const desired = formData.get("publish") === "true"; // true => publish
  if (!id) return;

  const { error } = await supabase
    .from("training_videos")
    .update({ published_at: desired ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    redirect(
      `/admin/training-videos?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath("/admin/training-videos");
}

export async function toggleFeaturedTrainingVideo(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = (formData.get("id") as string | null) ?? "";
  const desired = formData.get("featured") === "true";
  if (!id) return;

  const { error } = await supabase
    .from("training_videos")
    .update({ featured: desired })
    .eq("id", id);
  if (error) {
    redirect(
      `/admin/training-videos?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath("/admin/training-videos");
}

export async function deleteTrainingVideo(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = (formData.get("id") as string | null) ?? "";
  if (!id) return;
  const { error } = await supabase.from("training_videos").delete().eq("id", id);
  if (error) {
    redirect(
      `/admin/training-videos?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath("/admin/training-videos");
}
