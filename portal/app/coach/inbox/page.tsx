import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  message_text: string | null;
  video_id: string | null;
  viewed_at: string | null;
  created_at: string;
  recipient_kid: { first_name: string } | { first_name: string }[] | null;
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

function kidName(row: Row): string {
  const k = row.recipient_kid;
  if (!k) return "Unknown";
  if (Array.isArray(k)) return k[0]?.first_name ?? "Unknown";
  return k.first_name;
}

export default async function CoachInboxPage() {
  const supabase = await createClient();

  // RLS already restricts coach_messages SELECT to sender_user_id = auth.uid()
  // when the JWT carries app_role='coach'. The eq() filter is redundant but
  // makes the query intent obvious.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("coach_messages")
    .select(
      "id, message_text, video_id, viewed_at, created_at, recipient_kid:recipient_kid_id(first_name)",
    )
    .eq("sender_user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Failed to load messages: {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-slate-600">
          Messages you have sent to families.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">
            You haven&apos;t sent any messages yet. Use the Ballpark mobile
            app to record a video for a family — it will show up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.map((row) => {
            const isVideo = !!row.video_id;
            const preview = isVideo
              ? "Video message"
              : (row.message_text ?? "").trim() || "(empty message)";
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      To {kidName(row)}
                    </span>
                    {isVideo ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        Video
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {preview}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-slate-500">
                    {relativeTime(row.created_at)}
                  </span>
                  {row.viewed_at ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Viewed
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Not viewed
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
