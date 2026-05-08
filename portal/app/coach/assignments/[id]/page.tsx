import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MuxVideo } from "@/components/MuxVideo";
import { Card, CardSectionLabel } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { ReviewForm } from "./ReviewForm";
import { CancelAssignmentButton } from "./CancelAssignmentButton";

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
  pending: "bg-warning-bg text-warning border-warning/40",
  submitted: "bg-info-bg text-info border-info/40",
  reviewed: "bg-success-bg text-success border-success/40",
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: errParam } = await searchParams;
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
      <Card className="border-danger/40 bg-danger-bg">
        <p className="text-sm text-danger">
          Failed to load assignment: {error.message}
        </p>
      </Card>
    );
  }
  if (!data) notFound();

  const row = data as Row;
  const kid = pickOne(row.kid);
  const drillVideo = pickOne(row.drill_video);

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

  const canEdit =
    row.status === "pending" && !!user && row.coach_user_id === user.id;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/coach/assignments"
            className="text-sm text-text-light transition-colors hover:text-gold"
          >
            ← Back to assignments
          </Link>
          <h1 className="mt-3 flex flex-wrap items-center gap-3 font-display text-3xl font-semibold uppercase tracking-wide text-cream-light">
            {row.title}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${STATUS_PILL[row.status]}`}
            >
              {STATUS_LABEL[row.status]}
            </span>
            {row.status === "submitted" ? (
              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-bg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">
                Needs review
              </span>
            ) : null}
          </h1>
          <p className="mt-2 text-sm text-text-light">
            For{" "}
            <span className="text-cream-light">
              {kid ? `${kid.first_name} ${kid.last_name}` : "Unknown kid"}
            </span>{" "}
            • assigned by{" "}
            <span className="text-cream-light">{coachName ?? "you"}</span> •
            created {fmtDate(row.created_at)}
          </p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-2">
            <CancelAssignmentButton assignmentId={row.id} />
            <LinkButton href={`/coach/assignments/${row.id}/edit`} size="md">
              Edit
            </LinkButton>
          </div>
        ) : (
          <Button
            type="button"
            disabled
            variant="secondary"
            title={
              row.status !== "pending"
                ? "The family has already marked this drill submitted."
                : "Only the assigning coach can edit this drill."
            }
          >
            Edit
          </Button>
        )}
      </div>

      {errParam ? (
        <Card padding="sm" className="border-danger/40 bg-danger-bg">
          <p className="text-sm text-danger">{errParam}</p>
        </Card>
      ) : null}

      <Card accent padding="lg" className="space-y-4">
        <CardSectionLabel>Drill</CardSectionLabel>
        <Field label="Description">
          {row.description?.trim() ? (
            <p className="whitespace-pre-wrap text-sm text-cream">
              {row.description}
            </p>
          ) : (
            <p className="text-sm text-text-light/70">—</p>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Due date">
            <p className="text-sm text-cream">{fmtDay(row.due_date)}</p>
          </Field>
          <Field label="Point reward">
            <p className="text-sm text-cream">
              <span className="font-semibold text-gold">
                {row.point_reward}
              </span>{" "}
              pts
            </p>
          </Field>
          <Field label="Estimated time">
            <p className="text-sm text-cream">
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
            <p className="text-sm text-text-light">
              Video attached but not ready yet (status:{" "}
              {drillVideo.status ?? "unknown"}).
            </p>
          ) : (
            <p className="text-sm text-text-light/70">No video attached</p>
          )}
        </Field>
      </Card>

      {row.status === "pending" ? (
        <Card padding="lg" className="space-y-2 border-dashed">
          <CardSectionLabel>Waiting on the family</CardSectionLabel>
          <p className="text-sm text-text-light">
            This drill hasn&apos;t been submitted yet. You&apos;ll be able to
            review it once {kid ? kid.first_name : "the kid"} marks it done.
          </p>
        </Card>
      ) : (
        <Card padding="lg" className="space-y-4">
          <CardSectionLabel>Submission</CardSectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Submitted at">
              <p className="text-sm text-cream">
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
                <p className="text-sm text-text-light">
                  The family marked this drill done without attaching a video.
                </p>
              )}
            </Field>
          </div>
        </Card>
      )}

      {row.status === "submitted" ? (
        <Card accent padding="lg" className="space-y-4">
          <div>
            <CardSectionLabel>Leave a review</CardSectionLabel>
            <p className="mt-1 text-sm text-text-light">
              Rate the drill 1–5 stars and write a short note for the family.
            </p>
          </div>
          <ReviewForm assignmentId={row.id} />
        </Card>
      ) : null}

      {row.status === "reviewed" ? (
        <Card padding="lg" className="space-y-4">
          <CardSectionLabel>Your review</CardSectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Reviewed at">
              <p className="text-sm text-cream">{fmtDate(row.reviewed_at)}</p>
            </Field>
            <Field label="Rating">
              <div className="flex items-center gap-1 text-2xl leading-none">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={
                      row.rating != null && n <= row.rating
                        ? "text-gold"
                        : "text-text-light/40"
                    }
                  >
                    {row.rating != null && n <= row.rating ? "★" : "☆"}
                  </span>
                ))}
                <span className="ml-2 text-sm text-text-light">
                  {row.rating != null ? `${row.rating} / 5` : "—"}
                </span>
              </div>
            </Field>
          </div>
          <Field label="Feedback">
            {row.feedback?.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-cream">
                {row.feedback}
              </p>
            ) : (
              <p className="text-sm text-text-light/70">—</p>
            )}
          </Field>
        </Card>
      ) : null}

      <Card padding="lg" className="space-y-4">
        <CardSectionLabel>Identifiers</CardSectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Assignment id">
            <p className="break-all font-mono text-xs text-cream">{row.id}</p>
          </Field>
          <Field label="Tenant id">
            <p className="break-all font-mono text-xs text-cream">
              {row.tenant_id}
            </p>
          </Field>
          <Field label="Kid id">
            <p className="break-all font-mono text-xs text-cream">
              {row.kid_id}
            </p>
          </Field>
          <Field label="Family id">
            <p className="break-all font-mono text-xs text-cream">
              {row.family_id}
            </p>
          </Field>
          <Field label="Coach user id">
            <p className="break-all font-mono text-xs text-cream">
              {row.coach_user_id}
            </p>
          </Field>
          <Field label="Drill video id">
            <p className="break-all font-mono text-xs text-cream">
              {row.drill_video_id ?? "—"}
            </p>
          </Field>
          <Field label="Last updated">
            <p className="text-sm text-cream">{fmtDate(row.updated_at)}</p>
          </Field>
        </div>
      </Card>
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-deep">
        {label}
      </p>
      {children}
    </div>
  );
}
