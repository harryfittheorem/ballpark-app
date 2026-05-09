/**
 * Admin training videos catalog (v0.7 task #121).
 *
 * Lists every row in the admin's tenant (drafts included) with
 * publish, feature, and delete server-action buttons. The "+ New"
 * button routes to the upload form.
 */
import Link from "next/link";
import { Card, CardSectionLabel } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import {
  togglePublishTrainingVideo,
  toggleFeaturedTrainingVideo,
  deleteTrainingVideo,
} from "./actions";

type Row = {
  id: string;
  title: string;
  category: string;
  level: string;
  coach_name: string | null;
  duration_sec: number | null;
  view_count: number;
  featured: boolean;
  published_at: string | null;
  mux_playback_id: string;
  created_at: string;
};

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function AdminTrainingVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("training_videos")
    .select(
      "id, title, category, level, coach_name, duration_sec, view_count, featured, published_at, mux_playback_id, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
            Training videos
          </h1>
          <p className="mt-1 text-sm text-text-light">
            HQ-curated catalog. Parents and coaches see published rows in
            the Train tab.
          </p>
        </div>
        <LinkButton href="/admin/training-videos/new">+ New video</LinkButton>
      </div>

      {sp.error ? (
        <Card padding="md" className="border-danger/40 bg-danger-bg">
          <p className="text-sm text-danger">{sp.error}</p>
        </Card>
      ) : null}

      {error ? (
        <Card padding="md" className="border-danger/40 bg-danger-bg">
          <p className="text-sm text-danger">
            Failed to load videos: {error.message}
          </p>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card accent padding="lg" className="text-center">
          <p className="text-sm text-cream-light">No training videos yet.</p>
          <p className="mt-2 text-xs text-text-light">
            Click + New video to add the first one.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} padding="md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CardSectionLabel>
                      {r.category} · {r.level}
                    </CardSectionLabel>
                    {r.published_at ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-darkest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-light">
                        Draft
                      </span>
                    )}
                    {r.featured ? (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Featured
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-1 font-display text-lg text-cream-light">
                    {r.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-text-light">
                    {fmtDuration(r.duration_sec)}
                    {r.coach_name ? ` · ${r.coach_name}` : ""}
                    {` · ${r.view_count.toLocaleString()} views`}
                  </p>
                  <p
                    className="mt-1 truncate font-mono text-[10px] text-text-light"
                    title={r.mux_playback_id}
                  >
                    {r.mux_playback_id}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={togglePublishTrainingVideo}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="hidden"
                      name="publish"
                      value={r.published_at ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-border-gold bg-darkest px-3 py-1.5 text-xs text-cream hover:border-gold hover:text-gold"
                    >
                      {r.published_at ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                  <form action={toggleFeaturedTrainingVideo}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="hidden"
                      name="featured"
                      value={r.featured ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-border-gold bg-darkest px-3 py-1.5 text-xs text-cream hover:border-gold hover:text-gold"
                    >
                      {r.featured ? "Unfeature" : "Feature"}
                    </button>
                  </form>
                  <form action={deleteTrainingVideo}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-danger/40 bg-danger/15 px-3 py-1.5 text-xs text-danger hover:bg-danger/25"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Link
        href="/admin"
        className="inline-block text-sm text-text-light hover:text-gold"
      >
        ← Back to admin
      </Link>
    </div>
  );
}
