import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MuxVideo } from "@/components/MuxVideo";
import { ReviewForm } from "./ReviewForm";

type Status = "pending" | "submitted" | "reviewed";

type Kid =
  | { first_name: string; last_name: string }
  | { first_name: string; last_name: string }[]
  | null;

type Video =
  | {
      id: string;
      mux_playback_id: string | null;
      status: string | null;
    }
  | {
      id: string;
      mux_playback_id: string | null;
      status: string | null;
    }[]
  | null;

type Row = {
  id: string;
  tenant_id: string;
  kid_id: string;
  family_id: string;
  coach_user_id: string;
  title: string;
  description: string | null;
  status: Status;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  submitted_video_url: string | null;
  reviewed_at: string | null;
  rating: number | null;
  feedback: string | null;
  point_reward: number;
  duration_estimate_minutes: number | null;
  drill_video_id: string | null;
  kid: Kid;
  drill_video: Video;
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "To do",
  submitted: "Submitted",
  reviewed: "Completed",
};

const STATUS_PILL: Record<Status, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  submitted: "bg-sky-50 text-sky-700 ring-sky-600/20",
  reviewed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: { user } }] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id, tenant_id, kid_id, family_id, coach_user_id, title, description, status, due_date, created_at, updated_at, submitted_at, submitted_video_url, reviewed_at, rating, feedback, point_reward, duration_estimate_minutes, drill_video_id, kid:kid_id(first_name, last_name), drill_video:drill_video_id(id, mux_playback_id, status)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Failed to load assignment: {error.message}
      </div>
    );
  }
  if (!data) notFound();

  const row = data as Row;
  const kid = pickOne(row.kid);
  const drillVideo = pickOne(row.drill_video);

  // Coach name: scoped to this signed-in coach per spec ("the signed-in
  // coach for now"). Looked up from public.coaches.
  let coachName: string | null = null;
  if (user && row.coach_user_id === user.id) {
    const { data: coachRow } = await supabase
      .from("coaches")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (coachRow) {
      coachName = `${coachRow.first_name} ${coachRow.last_name}`.trim();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/coach/assignments"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to assignments
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {row.title}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${STATUS_PILL[row.status]}`}
            >
              {STATUS_LABEL[row.status]}
            </span>
            {row.status === "submitted" ? (
              <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-700 ring-1 ring-inset ring-orange-600/20">
                Needs review
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            For {kid ? `${kid.first_name} ${kid.last_name}` : "Unknown kid"} •
            assigned by {coachName ?? "you"} • created{" "}
            {fmtDate(row.created_at)}
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Drill
        </h2>
        <Field label="Description">
          {row.description?.trim() ? (
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {row.description}
            </p>
          ) : (
            <p className="text-sm text-slate-400">—</p>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Due date">
            <p className="text-sm text-slate-800">{fmtDay(row.due_date)}</p>
          </Field>
          <Field label="Point reward">
            <p className="text-sm text-slate-800">{row.point_reward} pts</p>
          </Field>
          <Field label="Estimated time">
            <p className="text-sm text-slate-800">
              {row.duration_estimate_minutes != null
                ? `${row.duration_estimate_minutes} min`
                : "—"}
            </p>
          </Field>
        </div>
        <Field label="Drill video">
          {drillVideo?.mux_playback_id &&
          (drillVideo.status === "ready" || drillVideo.status == null) ? (
            <MuxVideo
              playbackId={drillVideo.mux_playback_id}
              title={row.title}
            />
          ) : drillVideo ? (
            <p className="text-sm text-slate-500">
              Video attached but not ready yet (status:{" "}
              {drillVideo.status ?? "unknown"}).
            </p>
          ) : (
            <p className="text-sm text-slate-400">No video attached</p>
          )}
        </Field>
      </section>

      {row.status === "pending" ? (
        <section className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Waiting on the family
          </h2>
          <p className="text-sm text-slate-600">
            This drill hasn&apos;t been submitted yet. You&apos;ll be able to
            review it once {kid ? kid.first_name : "the kid"} marks it done.
          </p>
        </section>
      ) : (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Submission
          </h2>
          <Field label="Submitted at">
            <p className="text-sm text-slate-800">
              {fmtDate(row.submitted_at)}
            </p>
          </Field>
          <Field label="Kid&apos;s video">
            {row.submitted_video_url ? (
              <MuxVideo
                src={row.submitted_video_url}
                title={`${row.title} — submission`}
              />
            ) : (
              <p className="text-sm text-slate-500">
                The family marked this drill done without attaching a video.
              </p>
            )}
          </Field>
        </section>
      )}

      {row.status === "submitted" ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Leave a review
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Rate the drill 1–5 stars and write a short note for the family.
            </p>
          </div>
          <ReviewForm assignmentId={row.id} />
        </section>
      ) : null}

      {row.status === "reviewed" ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Your review
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Reviewed at">
              <p className="text-sm text-slate-800">
                {fmtDate(row.reviewed_at)}
              </p>
            </Field>
            <Field label="Rating">
              <div className="flex items-center gap-1 text-2xl leading-none">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={
                      row.rating != null && n <= row.rating
                        ? "text-amber-500"
                        : "text-slate-300"
                    }
                  >
                    {row.rating != null && n <= row.rating ? "★" : "☆"}
                  </span>
                ))}
                <span className="ml-2 text-sm text-slate-500">
                  {row.rating != null ? `${row.rating} / 5` : "—"}
                </span>
              </div>
            </Field>
          </div>
          <Field label="Feedback">
            {row.feedback?.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-slate-800">
                {row.feedback}
              </p>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </Field>
        </section>
      ) : null}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Identifiers
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Assignment id">
            <p className="break-all font-mono text-xs text-slate-700">
              {row.id}
            </p>
          </Field>
          <Field label="Tenant id">
            <p className="break-all font-mono text-xs text-slate-700">
              {row.tenant_id}
            </p>
          </Field>
          <Field label="Kid id">
            <p className="break-all font-mono text-xs text-slate-700">
              {row.kid_id}
            </p>
          </Field>
          <Field label="Family id">
            <p className="break-all font-mono text-xs text-slate-700">
              {row.family_id}
            </p>
          </Field>
          <Field label="Coach user id">
            <p className="break-all font-mono text-xs text-slate-700">
              {row.coach_user_id}
            </p>
          </Field>
          <Field label="Drill video id">
            <p className="break-all font-mono text-xs text-slate-700">
              {row.drill_video_id ?? "—"}
            </p>
          </Field>
          <Field label="Last updated">
            <p className="text-sm text-slate-800">{fmtDate(row.updated_at)}</p>
          </Field>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}
