import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

type RawRow = {
  id: string;
  message_text: string | null;
  video_id: string | null;
  viewed_at: string | null;
  created_at: string;
  sender_user_id: string;
  recipient_kid_id: string | null;
  recipient_family_id: string | null;
  recipient_coach_user_id: string | null;
  recipient_kid: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null;
};

type ConversationRow = {
  kidId: string;
  kidName: string;
  lastMessageText: string | null;
  lastHasVideo: boolean;
  lastCreatedAt: string;
  lastIsInbound: boolean;
  hasUnread: boolean;
};

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string): string {
  if (!iso) return "";
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

function kidNameFromRow(row: RawRow): string {
  const k = row.recipient_kid;
  if (!k) return "Unknown";
  const item = Array.isArray(k) ? k[0] : k;
  if (!item) return "Unknown";
  return [item.first_name, item.last_name].filter(Boolean).join(" ");
}

export default async function CoachInboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("coach_messages")
    .select(
      "id, message_text, video_id, viewed_at, created_at, sender_user_id, recipient_kid_id, recipient_family_id, recipient_coach_user_id, recipient_kid:recipient_kid_id(first_name, last_name)",
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

  const rows = (data ?? []) as unknown as RawRow[];

  // Group by recipient_kid_id — one conversation per kid.
  // Walk newest-first so first encounter = latest message.
  const folder = new Map<string, ConversationRow>();
  for (const row of rows) {
    const kidId = row.recipient_kid_id;
    if (!kidId) continue;
    if (folder.has(kidId)) continue;

    const isInbound = row.sender_user_id !== user!.id;
    folder.set(kidId, {
      kidId,
      kidName: kidNameFromRow(row),
      lastMessageText: row.message_text,
      lastHasVideo: !!row.video_id,
      lastCreatedAt: row.created_at,
      lastIsInbound: isInbound,
      hasUnread: isInbound && !row.viewed_at,
    });
  }

  const conversations = Array.from(folder.values());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Inbox
        </h1>
        <p className="mt-1 text-sm text-text-light">
          One conversation per athlete — tap to view the full thread and reply.
        </p>
      </div>

      {conversations.length === 0 ? (
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-sm text-text-light">
            No messages yet. Use the Ballpark mobile app to record a video for
            a family — it will show up here.
          </p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-border-gold">
            {conversations.map((conv) => {
              const preview = conv.lastHasVideo
                ? "📹 Video message"
                : conv.lastMessageText?.trim() || "(empty message)";

              const initials = conv.kidName
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <li key={conv.kidId}>
                  <Link
                    href={`/coach/inbox/${conv.kidId}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-darkest/40"
                  >
                    {/* Avatar */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-darker border border-border-gold">
                      <span className="font-display text-base font-semibold text-gold">
                        {initials || "?"}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold uppercase tracking-wide ${conv.hasUnread ? "text-cream-light" : "text-text-light"}`}
                        >
                          {conv.kidName}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          {conv.hasUnread && (
                            <span className="h-2 w-2 rounded-full bg-gold" />
                          )}
                          <span className="text-xs text-text-light">
                            {relativeTime(conv.lastCreatedAt)}
                          </span>
                        </div>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-sm ${conv.hasUnread ? "font-medium text-cream-light" : "text-text-light"}`}
                      >
                        {conv.lastIsInbound ? "" : "You: "}
                        {preview}
                      </p>
                    </div>

                    {/* Chevron */}
                    <svg
                      className="h-4 w-4 shrink-0 text-text-light/40"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
