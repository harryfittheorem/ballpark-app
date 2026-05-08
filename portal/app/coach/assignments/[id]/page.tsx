import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Status = "pending" | "submitted" | "reviewed";

type Kid =
  | { first_name: string; last_name: string }
  | { first_name: string; last_name: string }[]
  | null;

type DrillVideo =
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
  title: string;
  description: string | null;
  status: Status;
  due_date: string | null;
  created_at: string;
  submitted_at: string | null;
  submitted_video_url: string | null;
  reviewed_at: string | null;
  rating: number | null;
  feedback: string | null;
  point_reward: number;
  duration_estimate_minutes: number | null;
  drill_video_id: string | null;
  kid: Kid;
  drill_video: DrillVideo;
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

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, title, description, status, due_date, created_at, submitted_at, submitted_video_url, reviewed_at, rating, feedback, point_reward, duration_estimate_minutes, drill_video_id, kid:kid_id(first_name, last_name), drill_video:drill_video_id(id, mux_playback_id, status)",
    )
    .eq("id", id)
    .maybeSingle();

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
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            For {kid ? `${kid.first_name} ${kid.last_name}` : "Unknown kid"} •
            created {fmtDate(row.created_at)}
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex shrink-0 cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
        >
          Edit
        </button>
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
          {drillVideo ? (
            <p className="text-sm text-slate-800">
              <span className="font-mono text-xs text-slate-500">
                {drillVideo.id}
              </span>
              <span className="ml-2 text-slate-500">
                ({drillVideo.status ?? "unknown"})
              </span>
            </p>
          ) : (
            <p className="text-sm text-slate-400">No video attached</p>
          )}
        </Field>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Status
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Submitted at">
            <p className="text-sm text-slate-800">
              {fmtDate(row.submitted_at)}
            </p>
          </Field>
          <Field label="Submitted video">
            {row.submitted_video_url ? (
              <a
                href={row.submitted_video_url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm text-sky-700 underline hover:text-sky-900"
              >
                {row.submitted_video_url}
              </a>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Review
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Reviewed at">
            <p className="text-sm text-slate-800">{fmtDate(row.reviewed_at)}</p>
          </Field>
          <Field label="Rating">
            <p className="text-sm text-slate-800">
              {row.rating != null ? `${row.rating} / 5` : "—"}
            </p>
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
