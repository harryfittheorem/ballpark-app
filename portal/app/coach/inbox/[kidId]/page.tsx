import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { InboxReplyForm } from "../InboxReplyForm";
import { ThreadMessages, type ThreadMessage } from "./ThreadMessages";

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

function normalizeVideo(
  raw: VideoRow | VideoRow[] | null,
): ThreadMessage["video"] {
  const v = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  if (!v) return null;
  return {
    id: v.id,
    status: v.status,
    mux_playback_id: v.mux_playback_id,
    duration_seconds: v.duration_seconds,
    purpose: v.purpose,
  };
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

  const raw = (data ?? []) as unknown as RawMessageRow[];

  // Normalise into the shape ThreadMessages expects.
  const initialMessages: ThreadMessage[] = raw.map((msg) => ({
    id: msg.id,
    created_at: msg.created_at,
    sender_user_id: msg.sender_user_id,
    sender_display: msg.sender_display,
    recipient_family_id: msg.recipient_family_id,
    recipient_kid_id: msg.recipient_kid_id,
    recipient_coach_user_id: msg.recipient_coach_user_id,
    message_text: msg.message_text,
    viewed_at: msg.viewed_at,
    video: normalizeVideo(msg.video),
  }));

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
      ) : (
        /* Chat bubbles — live via Realtime */
        <Card padding="none" className="overflow-hidden">
          <ThreadMessages
            initialMessages={initialMessages}
            kidId={kidId}
            coachUserId={user!.id}
          />
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
