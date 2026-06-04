"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ThreadMessage = {
  id: string;
  created_at: string;
  sender_user_id: string;
  sender_display: string | null;
  recipient_family_id: string | null;
  recipient_kid_id: string | null;
  recipient_coach_user_id: string | null;
  message_text: string | null;
  viewed_at: string | null;
  video: {
    id: string;
    status: string;
    mux_playback_id: string | null;
    duration_seconds: number | null;
    purpose: string;
  } | null;
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

interface Props {
  initialMessages: ThreadMessage[];
  kidId: string;
  coachUserId: string;
}

export function ThreadMessages({ initialMessages, kidId, coachUserId }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on mount and when messages grow.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Supabase Realtime: append new messages without a page reload.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`portal-coach-thread-${kidId}-${coachUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coach_messages",
          filter: `recipient_kid_id=eq.${kidId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;

          // Guard: only messages in this (kid, coach) thread.
          if (
            row.sender_user_id !== coachUserId &&
            row.recipient_coach_user_id !== coachUserId
          ) {
            return;
          }

          const id = row.id as string;

          setMessages((prev) => {
            if (prev.some((m) => m.id === id)) return prev;

            const msg: ThreadMessage = {
              id,
              created_at: row.created_at as string,
              sender_user_id: row.sender_user_id as string,
              sender_display: (row.sender_display as string | null) ?? null,
              recipient_family_id:
                (row.recipient_family_id as string | null) ?? null,
              recipient_kid_id:
                (row.recipient_kid_id as string | null) ?? kidId,
              recipient_coach_user_id:
                (row.recipient_coach_user_id as string | null) ?? null,
              message_text: (row.message_text as string | null) ?? null,
              viewed_at: (row.viewed_at as string | null) ?? null,
              // Video rows inserted via Mux webhook arrive after processing;
              // the INSERT itself has no video join. Show null (no bubble).
              video: null,
            };

            return [...prev, msg];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kidId, coachUserId]);

  if (messages.length === 0) {
    return (
      <p className="text-sm text-text-light">
        No messages yet in this thread.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      {messages.map((msg) => {
        const isSelf = msg.sender_user_id === coachUserId;
        const video = msg.video;
        const created = new Date(msg.created_at);
        const timeStr = Number.isNaN(created.getTime())
          ? ""
          : relativeTime(msg.created_at);

        return (
          <div
            key={msg.id}
            className={`flex flex-col gap-1 ${isSelf ? "items-end" : "items-start"}`}
          >
            {/* Sender label + time */}
            <div
              className={`flex items-center gap-2 ${isSelf ? "flex-row-reverse" : ""}`}
            >
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                  isSelf
                    ? "bg-gold text-dark"
                    : "bg-gold/20 text-gold"
                }`}
              >
                {isSelf ? "You" : (msg.sender_display ?? "Family")}
              </span>
              {timeStr && (
                <span className="text-[11px] text-text-light/60">
                  {timeStr}
                </span>
              )}
            </div>

            {/* Bubble */}
            {video?.mux_playback_id ? (
              <div
                className={`overflow-hidden rounded-2xl border ${isSelf ? "border-gold" : "border-border-gold"}`}
                style={{ width: 240 }}
              >
                <div className="relative aspect-video bg-darkest">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg?width=480`}
                    alt="Video thumbnail"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="text-4xl">▶</span>
                  </div>
                </div>
                <p className="px-3 py-2 text-xs text-text-light">
                  Video message
                </p>
              </div>
            ) : video ? (
              <div
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${isSelf ? "border-gold bg-gold/10" : "border-border-gold bg-dark"}`}
                style={{ maxWidth: 280 }}
              >
                <span className="text-xl">🎬</span>
                <span className="text-sm text-text-light">
                  Processing video…
                </span>
              </div>
            ) : (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                  isSelf
                    ? "border-gold bg-gold text-dark font-medium"
                    : "border-border-gold bg-dark text-cream-light"
                }`}
                style={{ maxWidth: 320 }}
              >
                {msg.message_text ?? ""}
              </div>
            )}
          </div>
        );
      })}

      {/* Invisible anchor used to scroll the thread to the bottom. */}
      <div ref={bottomRef} />
    </div>
  );
}
