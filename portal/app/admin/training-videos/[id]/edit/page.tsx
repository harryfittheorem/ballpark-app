/**
 * Edit an existing training video (v0.7 task #121 follow-up).
 *
 * Reuses TrainingVideoForm in `mode="edit"` with the row prefilled.
 * Publish / Feature toggles stay on the catalog list — this page only
 * edits metadata + playback id, preserving view_count, created_at,
 * featured, and published_at.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { TrainingVideoForm } from "../../new/TrainingVideoForm";

type Row = {
  id: string;
  title: string;
  description: string | null;
  category: "hitting" | "mental" | "situational" | "fielding";
  level: "beginner" | "intermediate" | "advanced";
  coach_name: string | null;
  duration_sec: number | null;
  mux_playback_id: string;
  featured: boolean;
  published_at: string | null;
};

export default async function EditTrainingVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_videos")
    .select(
      "id, title, description, category, level, coach_name, duration_sec, mux_playback_id, featured, published_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }
  const row = data as Row;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Edit training video
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Update title, description, category, level, coach, duration, or
          playback id. Publish status and featured flag are managed from
          the catalog list.
        </p>
      </div>

      {sp.error ? (
        <Card padding="md" className="border-danger/40 bg-danger-bg">
          <p className="text-sm text-danger">{sp.error}</p>
        </Card>
      ) : null}

      <TrainingVideoForm
        mode="edit"
        defaults={{
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category,
          level: row.level,
          coachName: row.coach_name,
          durationSec: row.duration_sec,
          muxPlaybackId: row.mux_playback_id,
          featured: row.featured,
          publishNow: row.published_at !== null,
        }}
      />

      <Link
        href="/admin/training-videos"
        className="inline-block text-sm text-text-light hover:text-gold"
      >
        ← Back to catalog
      </Link>
    </div>
  );
}
