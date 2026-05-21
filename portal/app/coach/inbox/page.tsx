import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { InboxReplyForm } from "./InboxReplyForm";

type Row = {
  id: string;
  message_text: string | null;
  video_id: string | null;
  viewed_at: string | null;
  created_at: string;
  sender_user_id: string;
  sender_display: string | null;
  recipient_coach_user_id: string | null;
  recipient_kid_id: string | null;
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

function kidId(row: Row): string | null {
  return row.recipient_kid_id;
}

export default async function CoachInboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("coach_messages")
    .select(
      "id, message_text, video_id, viewed_at, created_at, sender_user_id, sender_display, recipient_coach_user_id, recipient_kid_id, recipient_kid:recipient_kid_id(first_name)",
    )
    .or(`sender_user_id.eq.${user!.id},recipient_coach_user_id.eq.${user!.id}`)
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
          Messages between you and your families.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-sm text-text-light">
            No messages yet. Use the Ballpark mobile app to record a video for
            a family — it will show up here.
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
              const isInbound = row.sender_user_id !== user!.id;
              const directionLabel = isInbound ? "From" : "To";
              const personName = isInbound
                ? row.sender_display?.trim() || "Family"
                : kidName(row);
              const threadKidId = kidId(row);
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-darkest/40 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          isInbound
                            ? "border border-gold bg-gold/10 text-gold"
                            : "border border-border-gold bg-darkest text-text-light"
                        }`}
                      >
                        {isInbound ? "Received" : "Sent"}
                      </span>
                      <span className="text-sm font-semibold text-cream-light">
                        {directionLabel} {personName}
                        {isInbound ? ` · about ${kidName(row)}` : ""}
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
                    {isInbound && threadKidId && (
                      <InboxReplyForm kidId={threadKidId} />
                    )}
                  </div>
                  <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <span className="text-xs text-text-light">
                      {relativeTime(row.created_at)}
                    </span>
                    {isInbound ? (
                      row.viewed_at ? (
                        <span className="text-[11px] text-text-light/70">
                          Read
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gold">
                          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                          New
                        </span>
                      )
                    ) : row.viewed_at ? (
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
