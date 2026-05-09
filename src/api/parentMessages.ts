/**
 * Parent-side messaging API (v0.7 task #120).
 *
 * Mirrors src/api/coachMessages.ts but flips the direction: the parent is
 * the SENDER, the addressed coach is pinned in
 * `coach_messages.recipient_coach_user_id` (added by migration
 * 20260509000000). Coach access to those rows is granted by RLS policy
 * `coach_messages_select_recipient_coach` — i.e. only the addressed coach
 * (and the parent sender, via `coach_messages_select_parent_sender`) can
 * read the row.
 *
 * Tables touched:
 *   coach_messages    insert with sender_user_id = parent.user_id,
 *                     recipient_coach_user_id = picked coach, label,
 *                     sender_display, optional video_id (parent_to_coach).
 *   coaches           list tenant coaches so the composer / inbox can show
 *                     a "to: <coach>" affordance.
 *
 * RLS is enforced server-side. The client passes tenant_id explicitly
 * because the policy WITH CHECK requires it on the row itself.
 */

import { supabase, supabaseExt } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { DatabaseExt } from '@/types/databaseExt';

// `supabaseExt` is the same connection / session as `supabase` but typed
// against `DatabaseExt`, which augments the generated types with the
// columns added by 20260509000000 (`label`, `sender_display`,
// `recipient_coach_user_id`). When the types are regenerated, swap
// `supabaseExt` -> `supabase` and delete `src/types/databaseExt.ts`.
type CoachMessageRowExt =
  DatabaseExt['public']['Tables']['coach_messages']['Row'];
type CoachMessageInsertExt =
  DatabaseExt['public']['Tables']['coach_messages']['Insert'];

export type ComposerLabel =
  | 'game_footage'
  | 'home_practice'
  | 'swing_check'
  | 'question'
  | 'other';

export const COMPOSER_LABELS: { value: ComposerLabel; label: string }[] = [
  { value: 'game_footage', label: 'Game footage' },
  { value: 'home_practice', label: 'Home practice' },
  { value: 'swing_check', label: 'Swing check' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

/** Lightweight coach projection for the composer + inbox. */
export type TenantCoach = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

/**
 * List every coach in the parent's tenant. Parents have a SELECT policy on
 * `public.coaches` introduced in v0.5 (`coaches_select_same_tenant`). We
 * return the lot — there's typically a handful per facility — and let the
 * UI pick a default (most-recent contacted, then alphabetical).
 */
export async function listTenantCoachesForParent(): Promise<TenantCoach[]> {
  const { data, error } = await supabase
    .from('coaches')
    .select('user_id, first_name, last_name, avatar_url');
  if (error) throw error;
  return (data ?? [])
    .filter((c): c is typeof c & { user_id: string } => !!c.user_id)
    .map((c) => ({
      userId: c.user_id,
      firstName: c.first_name,
      lastName: c.last_name,
      avatarUrl: c.avatar_url,
    }));
}

/**
 * Input shape for `sendParentMessage`. Mirrors `SendCoachMessageInput`
 * with parent-side additions (`label`, `senderDisplay`).
 */
export type SendParentMessageInput = {
  videoId: string | null;
  recipientFamilyId: string;
  recipientKidId: string;
  recipientCoachUserId: string;
  label: ComposerLabel | null;
  senderDisplay: string | null;
  messageText: string | null;
};

export type SentParentMessage = CoachMessageRowExt;

/**
 * Insert a parent->coach row. Tenant + sender are looked up from the
 * caller's session/family so the client can't smuggle either.
 */
export async function sendParentMessage(
  input: SendParentMessageInput,
): Promise<SentParentMessage> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('You appear to be signed out. Sign back in and try again.');

  const { data: family, error: famErr } = await supabase
    .from('families')
    .select('tenant_id')
    .eq('parent_user_id', user.id)
    .maybeSingle();
  if (famErr) throw famErr;
  if (!family) throw new Error('Family profile not found for the current user.');

  const insertRow: CoachMessageInsertExt = {
    tenant_id: family.tenant_id,
    sender_user_id: user.id,
    video_id: input.videoId,
    recipient_family_id: input.recipientFamilyId,
    recipient_kid_id: input.recipientKidId,
    recipient_coach_user_id: input.recipientCoachUserId,
    message_text: input.messageText,
    label: input.label,
    sender_display: input.senderDisplay,
  };
  const { data, error } = await supabaseExt
    .from('coach_messages')
    .insert(insertRow)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Row in the bidirectional message thread. Sender side is decided by the
 * caller comparing `senderUserId` to their own `auth.uid()`.
 */
export type ThreadMessage = {
  id: string;
  createdAt: string;
  senderUserId: string;
  recipientFamilyId: string;
  recipientKidId: string;
  recipientCoachUserId: string | null;
  messageText: string | null;
  label: string | null;
  senderDisplay: string | null;
  viewedAt: string | null;
  video: {
    id: string;
    status: string;
    muxPlaybackId: string | null;
    durationSeconds: number | null;
    purpose: string;
  } | null;
};

type ThreadJoinRow = {
  id: string;
  created_at: string;
  sender_user_id: string;
  recipient_family_id: string;
  recipient_kid_id: string;
  recipient_coach_user_id: string | null;
  message_text: string | null;
  label: string | null;
  sender_display: string | null;
  viewed_at: string | null;
  video:
    | Pick<
        Tables<'videos'>,
        'id' | 'status' | 'mux_playback_id' | 'duration_seconds' | 'purpose'
      >
    | Pick<
        Tables<'videos'>,
        'id' | 'status' | 'mux_playback_id' | 'duration_seconds' | 'purpose'
      >[]
    | null;
};

function mapThreadRow(r: ThreadJoinRow): ThreadMessage {
  const v = Array.isArray(r.video) ? r.video[0] ?? null : r.video;
  return {
    id: r.id,
    createdAt: r.created_at,
    senderUserId: r.sender_user_id,
    recipientFamilyId: r.recipient_family_id,
    recipientKidId: r.recipient_kid_id,
    recipientCoachUserId: r.recipient_coach_user_id,
    messageText: r.message_text,
    label: r.label,
    senderDisplay: r.sender_display,
    viewedAt: r.viewed_at,
    video: v
      ? {
          id: v.id,
          status: v.status,
          muxPlaybackId: v.mux_playback_id,
          durationSeconds: v.duration_seconds,
          purpose: v.purpose,
        }
      : null,
  };
}

/**
 * Bidirectional thread for a (kid, coach) pair. Returns every message
 * for this kid that is either:
 *   - sent BY the coach (coach -> parent), OR
 *   - sent BY the parent AND addressed TO this coach via
 *     `recipient_coach_user_id`.
 *
 * Both arms are unioned with PostgREST's `or` syntax. Sorted ascending so
 * the FlatList renders bottom-up like a chat.
 */
export async function listMessageThread(opts: {
  kidId: string;
  coachUserId: string;
  selfUserId: string;
}): Promise<ThreadMessage[]> {
  const { kidId, coachUserId, selfUserId } = opts;
  const { data, error } = await supabaseExt
    .from('coach_messages')
    .select(
      'id, created_at, sender_user_id, recipient_family_id, recipient_kid_id, recipient_coach_user_id, message_text, label, sender_display, viewed_at, video:videos(id, status, mux_playback_id, duration_seconds, purpose)',
    )
    .eq('recipient_kid_id', kidId)
    .or(
      `sender_user_id.eq.${coachUserId},and(sender_user_id.eq.${selfUserId},recipient_coach_user_id.eq.${coachUserId})`,
    )
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as ThreadJoinRow[]).map(mapThreadRow);
}

/**
 * Inbox row for the parent — one row per coach who has been part of any
 * thread for this kid (either direction). Folded client-side from the
 * full message list (typical inbox is < 10 coaches).
 */
export type InboxRow = {
  coachUserId: string;
  coachFirstName: string | null;
  coachLastName: string | null;
  coachAvatarUrl: string | null;
  lastCreatedAt: string;
  lastMessageText: string | null;
  lastHasVideo: boolean;
  lastSenderIsSelf: boolean;
  unread: boolean;
};

export async function listParentInbox(opts: {
  kidId: string;
  selfUserId: string;
}): Promise<InboxRow[]> {
  const { kidId, selfUserId } = opts;

  const { data: msgs, error } = await supabaseExt
    .from('coach_messages')
    .select(
      'id, created_at, sender_user_id, recipient_coach_user_id, message_text, viewed_at, video_id',
    )
    .eq('recipient_kid_id', kidId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // No messages yet — surface every coach in the tenant so the parent can
  // start a thread from a cold inbox.
  const coachRows: TenantCoach[] = await listTenantCoachesForParent();
  const coachById = new Map(coachRows.map((c) => [c.userId, c]));

  // Build per-coach last-message folder. The conversation-partner coach is
  // deterministic now: for inbound rows it's `sender_user_id`; for
  // parent-sent rows it's `recipient_coach_user_id` (set by the composer).
  // Walk newest-first so the first time we encounter a coach is the
  // last-message timestamp.
  type RawMsg = {
    id: string;
    created_at: string;
    sender_user_id: string;
    recipient_coach_user_id: string | null;
    message_text: string | null;
    viewed_at: string | null;
    video_id: string | null;
  };
  const folder = new Map<string, InboxRow>();
  for (const m of (msgs ?? []) as RawMsg[]) {
    const isSelf = m.sender_user_id === selfUserId;
    const coachId = isSelf ? m.recipient_coach_user_id : m.sender_user_id;
    if (!coachId) continue;
    if (folder.has(coachId)) continue;
    const c = coachById.get(coachId);
    folder.set(coachId, {
      coachUserId: coachId,
      coachFirstName: c?.firstName ?? null,
      coachLastName: c?.lastName ?? null,
      coachAvatarUrl: c?.avatarUrl ?? null,
      lastCreatedAt: m.created_at,
      lastMessageText: m.message_text,
      lastHasVideo: !!m.video_id,
      lastSenderIsSelf: isSelf,
      unread: !isSelf && !m.viewed_at,
    });
  }

  // Fill in any tenant coach with no messages so the cold inbox isn't blank.
  for (const c of coachRows) {
    if (!folder.has(c.userId)) {
      folder.set(c.userId, {
        coachUserId: c.userId,
        coachFirstName: c.firstName,
        coachLastName: c.lastName,
        coachAvatarUrl: c.avatarUrl,
        lastCreatedAt: '',
        lastMessageText: null,
        lastHasVideo: false,
        lastSenderIsSelf: false,
        unread: false,
      });
    }
  }

  return Array.from(folder.values()).sort((a, b) =>
    b.lastCreatedAt.localeCompare(a.lastCreatedAt),
  );
}
