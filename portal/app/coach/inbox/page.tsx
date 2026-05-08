import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

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
      <Card padding="md" className="border-danger/40 bg-danger-bg">
        <p className="text-sm text-danger">
          Failed to load messages: {error.message}
        </p>
      </Card>
    );
  }

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Inbox
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Messages you have sent to families.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-sm text-text-light">
            You haven&apos;t sent any messages yet. Use the Ballpark mobile
            app to record a video for a family — it will show up here.
          </p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-border-gold">
            {rows.map((row) => {
              const isVideo = !!row.video_id;
              const preview = isVideo
                ? "Video message"
                : (row.message_text ?? "").trim() || "(empty message)";
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-darkest/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-cream-light">
                        To {kidName(row)}
                      </span>
                      {isVideo ? (
                        <span className="inline-flex items-center rounded-full border border-border-gold bg-darkest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                          Video
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-text-light">
                      {preview}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-text-light">
                      {relativeTime(row.created_at)}
                    </span>
                    {row.viewed_at ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Viewed
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-light/70">
                        Not viewed
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
