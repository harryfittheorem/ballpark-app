import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { InboxReplyForm } from "../InboxReplyForm";

type VideoRow = {
  id: string;
  status: string;
  mux_playback_id: string | null;
  duration_seconds: number | null;
  purpose: string;
};

type RawMessageRow = {
  id: string;
  created_at: string;
  sender_user_id: string;
  sender_display: string | null;
  recipient_family_id: string | null;
  recipient_kid_id: string | null;
  recipient_coach_user_id: string | null;
  message_text: string | null;
  viewed_at: string | null;
  video: VideoRow | VideoRow[] | null;
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

export default async function CoachInboxThreadPage({
  params,
}: {
  params: Promise<{ kidId: string }>;
}) {
  const { kidId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch kid info for the header
  const { data: kid } = await supabase
    .from("kids")
    .select("id, first_name, last_name, family_id")
    .eq("id", kidId)
    .maybeSingle();

  if (!kid) notFound();

  // Fetch bidirectional thread — same logic as listCoachMessageThread on mobile
  const { data, error } = await supabase
    .from("coach_messages")
    .select(
      "id, created_at, sender_user_id, sender_display, recipient_family_id, recipient_kid_id, recipient_coach_user_id, message_text, viewed_at, video:videos(id, status, mux_playback_id, duration_seconds, purpose)",
    )
    .eq("recipient_kid_id", kidId)
    .or(
      `sender_user_id.eq.${user!.id},recipient_coach_user_id.eq.${user!.id}`,
    )
    .order("created_at", { ascending: true });

  const messages = (data ?? []) as unknown as RawMessageRow[];
  const kidDisplayName = [kid.first_name, kid.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/coach/inbox"
          className="inline-flex items-center gap-1.5 text-sm text-text-light transition-colors hover:text-cream-light"
        >
          <ArrowLeft size={16} />
          Inbox
        </Link>
        <span className="text-text-light/40">/</span>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-cream-light">
          {kidDisplayName}
        </h1>
      </div>

      {error ? (
        <Card padding="md" className="border-danger/40 bg-danger-bg">
          <p className="text-sm text-danger">
            Failed to load thread: {error.message}
          </p>
        </Card>
      ) : messages.length === 0 ? (
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-sm text-text-light">
            No messages yet in this thread.
          </p>
        </Card>
      ) : (
        /* Chat bubbles */
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col gap-3 p-5">
            {messages.map((msg) => {
              const isSelf = msg.sender_user_id === user!.id;
              const video = Array.isArray(msg.video)
                ? (msg.video[0] ?? null)
                : msg.video;
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
          </div>
        </Card>
      )}

      {/* Reply area */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-light">
              Reply
            </h2>
            <InboxReplyForm kidId={kidId} />
          </div>
          <div className="shrink-0 rounded-xl border border-border-gold bg-darkest p-4 text-center">
            <Smartphone size={20} className="mx-auto mb-1.5 text-text-light/60" />
            <p className="text-[11px] leading-snug text-text-light/60">
              Record video
              <br />
              from the app
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
