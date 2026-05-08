import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  submitted: "bg-sky-50 text-sky-700 ring-sky-600/20",
  reviewed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
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
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Failed to load assignments: {error.message}
      </div>
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
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Drills you have assigned to your families.
          </p>
        </div>
        <Link
          href="/coach/assignments/new"
          className="inline-flex shrink-0 items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New assignment
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">
            You haven&apos;t created any assignments yet. Tap{" "}
            <span className="font-medium">New assignment</span> to send a drill
            to one of your families.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.status}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-500">
                {STATUS_LABEL[group.status]}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {group.rows.length}
                </span>
              </h2>
              {group.rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-400">
                  {emptyCopy[group.status]}
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {group.rows.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/coach/assignments/${row.id}`}
                        className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {row.title}
                            </span>
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
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-600">
                            For {kidName(row)}
                            {row.due_date
                              ? ` • due ${formatDueDate(row.due_date)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-slate-500">
                            {relativeTime(row.created_at)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
