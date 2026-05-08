import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

type Status = "pending" | "submitted" | "reviewed";

type Row = {
  id: string;
  title: string;
  status: Status;
  due_date: string | null;
  created_at: string;
  kid: { first_name: string } | { first_name: string }[] | null;
};

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return RTF.format(diffSec, "second");
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return RTF.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 30)
    return RTF.format(Math.round(diffSec / (86400 * 7)), "week");
  if (abs < 86400 * 365)
    return RTF.format(Math.round(diffSec / (86400 * 30)), "month");
  return RTF.format(Math.round(diffSec / (86400 * 365)), "year");
}

function formatDueDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function kidName(row: Row): string {
  const k = row.kid;
  if (!k) return "Unknown";
  if (Array.isArray(k)) return k[0]?.first_name ?? "Unknown";
  return k.first_name;
}

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

export default async function CoachAssignmentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, title, status, due_date, created_at, kid:kid_id(first_name)",
    )
    .eq("coach_user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <Card className="border-danger/40 bg-danger-bg">
        <p className="text-sm text-danger">
          Failed to load assignments: {error.message}
        </p>
      </Card>
    );
  }

  const rows = (data ?? []) as Row[];

  const groups: Array<{ status: Status; rows: Row[] }> = [
    { status: "submitted", rows: rows.filter((r) => r.status === "submitted") },
    { status: "pending", rows: rows.filter((r) => r.status === "pending") },
    { status: "reviewed", rows: rows.filter((r) => r.status === "reviewed") },
  ];

  const emptyCopy: Record<Status, string> = {
    submitted: "No submissions waiting.",
    pending: "Nothing here.",
    reviewed: "Nothing here.",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
            Assignments
          </h1>
          <p className="mt-1 text-sm text-text-light">
            Drills you have assigned to your families.
          </p>
        </div>
        <LinkButton href="/coach/assignments/new">
          New assignment
        </LinkButton>
      </div>

      {rows.length === 0 ? (
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-sm text-text-light">
            You haven&apos;t created any assignments yet. Tap{" "}
            <span className="font-semibold text-cream-light">
              New assignment
            </span>{" "}
            to send a drill to one of your families.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.status}>
              <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-deep">
                {STATUS_LABEL[group.status]}
                <span className="rounded-full border border-border-gold bg-darker px-2 py-0.5 text-[10px] font-semibold text-gold">
                  {group.rows.length}
                </span>
              </h2>
              {group.rows.length === 0 ? (
                <Card padding="sm" className="border-dashed text-center">
                  <p className="text-xs text-text-light/70">
                    {emptyCopy[group.status]}
                  </p>
                </Card>
              ) : (
                <Card padding="none" className="overflow-hidden">
                  <ul className="divide-y divide-border-gold">
                    {group.rows.map((row) => (
                      <li key={row.id}>
                        <Link
                          href={`/coach/assignments/${row.id}`}
                          className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-darkest/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-cream-light">
                                {row.title}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_PILL[row.status]}`}
                              >
                                {STATUS_LABEL[row.status]}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm text-text-light">
                              For {kidName(row)}
                              {row.due_date
                                ? ` • due ${formatDueDate(row.due_date)}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs text-text-light">
                              {relativeTime(row.created_at)}
                            </span>
                            {row.status === "submitted" ? (
                              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
                                Needs review
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
