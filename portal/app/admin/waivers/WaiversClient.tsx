"use client";

import { useActionState, useState, useTransition } from "react";

import { Card } from "@/components/ui/Card";
import { exportCsv } from "@/lib/exportCsv";

import { publishNewWaiverVersion, sendWaiverReminder } from "./actions";

export type WaiverRow = {
  family_id: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  signed_at: string | null;
  app_version: string | null;
  waiver_version: number | null;
  status: "signed" | "unsigned" | "outdated";
};

type Props = {
  rows: WaiverRow[];
  activeVersion: number | null;
  activeWaiverBodyText: string | null;
  activeWaiverEffectiveDate: string | null;
};

type Filter = "all" | "signed" | "unsigned" | "outdated";

const STATUS_STYLES: Record<WaiverRow["status"], string> = {
  signed: "bg-success/15 text-success border-success/30",
  unsigned: "bg-danger/15 text-danger border-danger/30",
  outdated: "bg-gold/15 text-gold border-gold/30",
};

const STATUS_LABELS: Record<WaiverRow["status"], string> = {
  signed: "Signed",
  unsigned: "Not signed",
  outdated: "Outdated",
};

function ReminderButton({ familyId, email }: { familyId: string; email: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await sendWaiverReminder(familyId);
      setResult(res);
      if (res.ok) {
        setTimeout(() => setResult(null), 4000);
      }
    });
  }

  if (result?.ok) {
    return (
      <span className="text-xs font-semibold text-success">
        Reminder sent to {email}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-border-gold bg-darker px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold transition hover:border-gold disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send Reminder"}
      </button>
      {result?.error && (
        <span className="text-xs text-danger">{result.error}</span>
      )}
    </div>
  );
}

function ContractEditor({
  bodyText,
  effectiveDate,
}: {
  bodyText: string | null;
  effectiveDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(publishNewWaiverVersion, null);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-border-gold bg-darker px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gold transition hover:border-gold"
      >
        <span>{open ? "▲" : "▼"}</span>
        {open ? "Close editor" : "Edit contract template"}
      </button>

      {open && (
        <Card padding="md" className="mt-3 space-y-4">
          <div>
            <p className="text-sm font-semibold text-cream-light">
              Contract Template Editor
            </p>
            <p className="mt-0.5 text-xs text-text-light">
              Publishing a new version marks all previously-signed families as
              &ldquo;Outdated&rdquo; &mdash; they will be prompted to re-sign in the app.
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-light">
                Effective date
              </label>
              <input
                type="date"
                name="effective_date"
                defaultValue={effectiveDate ?? new Date().toISOString().slice(0, 10)}
                className="rounded-md border border-border-gold bg-dark px-3 py-1.5 text-sm text-cream-light focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-light">
                Contract body text
              </label>
              <textarea
                name="body_text"
                defaultValue={bodyText ?? ""}
                rows={24}
                required
                className="w-full rounded-md border border-border-gold bg-dark px-3 py-2 font-mono text-xs leading-relaxed text-cream-light focus:border-gold focus:outline-none"
              />
            </div>

            {state?.error && (
              <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}

            {state?.ok && (
              <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                Published as v{state.version}. Families will be prompted to
                re-sign in the app.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md border border-gold bg-gold px-5 py-2 text-sm font-semibold uppercase tracking-wide text-dark transition hover:bg-gold/90 disabled:opacity-50"
              >
                {isPending ? "Publishing…" : "Publish new version"}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function WaiversClient({
  rows,
  activeVersion,
  activeWaiverBodyText,
  activeWaiverEffectiveDate,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const counts = {
    all: rows.length,
    signed: rows.filter((r) => r.status === "signed").length,
    unsigned: rows.filter((r) => r.status === "unsigned").length,
    outdated: rows.filter((r) => r.status === "outdated").length,
  };

  function handleExport() {
    exportCsv(
      `waivers-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        ...r,
        full_name: `${r.parent_first_name} ${r.parent_last_name}`.trim(),
        signed_at_fmt: r.signed_at
          ? new Date(r.signed_at).toLocaleString()
          : "",
        status_label: STATUS_LABELS[r.status],
      })),
      [
        { label: "Family Name", key: "full_name" },
        { label: "Email", key: "parent_email" },
        { label: "Status", key: "status_label" },
        { label: "Signed At", key: "signed_at_fmt" },
        { label: "Waiver Version", key: "waiver_version" },
        { label: "App Version", key: "app_version" },
      ],
    );
  }

  return (
    <div className="space-y-6">
      {/* Contract editor */}
      <ContractEditor
        bodyText={activeWaiverBodyText}
        effectiveDate={activeWaiverEffectiveDate}
      />

      {/* Filter + Export */}
      <div className="flex flex-wrap items-center gap-3">
        {(["all", "signed", "unsigned", "outdated"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-full border px-4 py-1.5 text-sm font-semibold uppercase tracking-wide transition",
              filter === f
                ? "border-gold bg-gold text-dark"
                : "border-border-gold text-text-light hover:border-gold hover:text-gold",
            ].join(" ")}
          >
            {f === "all" ? "All" : STATUS_LABELS[f as WaiverRow["status"]]}{" "}
            <span className="opacity-70">({counts[f]})</span>
          </button>
        ))}

        <button
          onClick={handleExport}
          className="ml-auto rounded-md border border-border-gold bg-darker px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gold transition hover:border-gold"
        >
          Export CSV
        </button>
      </div>

      {/* Active version note */}
      {activeVersion !== null && (
        <p className="text-sm text-text-light">
          Active waiver:{" "}
          <span className="font-semibold text-gold">v{activeVersion}</span>
          {counts.outdated > 0 && (
            <span className="ml-2 text-gold">
              — {counts.outdated} famil
              {counts.outdated === 1 ? "y has" : "ies have"} signed an older
              version and will be re-prompted.
            </span>
          )}
        </p>
      )}

      {/* Table */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card padding="md" className="border-dashed">
            <p className="text-sm text-text-light">
              No families match this filter.
            </p>
          </Card>
        ) : (
          filtered.map((row) => (
            <Card key={row.family_id} padding="md">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base text-cream-light">
                    {row.parent_first_name} {row.parent_last_name}
                  </p>
                  <p className="text-sm text-text-light">{row.parent_email}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={[
                      "rounded-full border px-3 py-0.5 text-xs font-semibold uppercase tracking-wide",
                      STATUS_STYLES[row.status],
                    ].join(" ")}
                  >
                    {STATUS_LABELS[row.status]}
                  </span>

                  {row.status === "signed" && (
                    <>
                      {row.signed_at && (
                        <span className="text-xs text-text-light">
                          {new Date(row.signed_at).toLocaleString()} · v
                          {row.waiver_version}
                          {row.app_version ? ` · app ${row.app_version}` : ""}
                        </span>
                      )}
                      <a
                        href={`/api/admin/waivers/${row.family_id}/pdf`}
                        download
                        className="text-xs font-semibold text-gold underline underline-offset-2 hover:text-gold/80"
                      >
                        Download PDF
                      </a>
                    </>
                  )}

                  {(row.status === "unsigned" || row.status === "outdated") && (
                    <ReminderButton
                      familyId={row.family_id}
                      email={row.parent_email}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
