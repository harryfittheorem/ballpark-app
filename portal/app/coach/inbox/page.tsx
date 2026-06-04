import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { InboxList, type ConversationRow } from "./InboxList";

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
  recipient_kid:
    | { first_name: string; last_name: string | null }
    | { first_name: string; last_name: string | null }[]
    | null;
};

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

      <Card padding="none" className="overflow-hidden">
        {/* InboxList is a client component that subscribes to Realtime and
            calls router.refresh() when a new message arrives, re-running this
            server component so the grouped list stays current automatically. */}
        <InboxList conversations={conversations} coachUserId={user!.id} />
      </Card>
    </div>
  );
}
