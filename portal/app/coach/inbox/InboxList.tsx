"use client";

/**
 * InboxList — real-time coach inbox conversation list.
 *
 * Receives the initial conversation data from the server component and
 * subscribes to Supabase Realtime INSERT events on coach_messages.  When a
 * new message arrives that involves this coach, it calls router.refresh() so
 * Next.js re-runs the server component and re-fetches the grouped conversation
 * list — keeping the heavy grouping logic on the server while still giving
 * near-instant updates without a manual page reload.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ConversationRow = {
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

interface Props {
  conversations: ConversationRow[];
  coachUserId: string;
}

export function InboxList({ conversations, coachUserId }: Props) {
  const router = useRouter();

  // Subscribe to new messages and trigger a server-side refresh so the
  // grouped list (last-message preview, unread dot) stays current.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`portal-coach-inbox-list-${coachUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coach_messages" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Only react when this coach is the sender or named recipient.
          if (
            row.sender_user_id !== coachUserId &&
            row.recipient_coach_user_id !== coachUserId
          ) {
            return;
          }
          // Re-run the server component to get fresh grouped data.
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [coachUserId, router]);

  if (conversations.length === 0) {
    return (
      <p className="text-sm text-text-light">
        No messages yet. Use the Clubhouse by Infinite Hitting mobile app to record a video for a
        family — it will show up here.
      </p>
    );
  }

  return (
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
  );
}
