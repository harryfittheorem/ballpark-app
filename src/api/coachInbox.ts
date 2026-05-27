/**
 * Coach-side inbox API.
 *
 * Fetches all coach_messages where the coach is either the SENDER
 * (coach→parent: sender_user_id = coachUserId) or the RECIPIENT
 * (parent→coach: recipient_coach_user_id = coachUserId), then folds
 * them into one row per family thread — latest message first.
 *
 * Uses the supabaseExt client (same session, extended types) so that
 * the v0.7 columns (label, sender_display, recipient_coach_user_id)
 * are typed correctly until types are regenerated.
 */

import { supabase, supabaseExt } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type CoachInboxRow = {
  /** The family this thread belongs to. */
  familyId: string;
  familyLastName: string;
  /** The kid in this thread (first kid encountered; one family = one kid in v0.5). */
  kidId: string;
  kidFirstName: string;
  kidLastName: string;
  /** coachUserId — always the caller's own user_id. Carried for convenience. */
  coachUserId: string;
  lastCreatedAt: string;
  lastMessageText: string | null;
  lastHasVideo: boolean;
  /** True when the last message is FROM the parent (i.e., unread by the coach). */
  unread: boolean;
};

type RawMsgRow = {
  id: string;
  created_at: string;
  sender_user_id: string;
  recipient_family_id: string;
  recipient_kid_id: string;
  recipient_coach_user_id: string | null;
  message_text: string | null;
  viewed_at: string | null;
  video_id: string | null;
};

type KidFamilyRow = Pick<
  Tables<'kids'>,
  'id' | 'first_name' | 'last_name' | 'family_id'
> & {
  family: Pick<Tables<'families'>, 'id' | 'parent_last_name'> | null;
};

export async function listCoachInbox(coachUserId: string): Promise<CoachInboxRow[]> {
  // Fetch all messages the coach is involved in (sender OR recipient).
  // PostgREST `or` filter across two columns.
  const { data: msgs, error } = await supabaseExt
    .from('coach_messages')
    .select(
      'id, created_at, sender_user_id, recipient_family_id, recipient_kid_id, recipient_coach_user_id, message_text, viewed_at, video_id',
    )
    .or(
      `sender_user_id.eq.${coachUserId},recipient_coach_user_id.eq.${coachUserId}`,
    )
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (msgs ?? []) as unknown as RawMsgRow[];

  // Build family-keyed map (newest message first = first encounter per family).
  const folder = new Map<
    string,
    { familyId: string; kidId: string; lastMsg: RawMsgRow; isFromParent: boolean }
  >();
  for (const m of rows) {
    const familyId = m.recipient_family_id;
    if (!familyId) continue;
    if (folder.has(familyId)) continue;
    const isFromParent = m.sender_user_id !== coachUserId;
    folder.set(familyId, {
      familyId,
      kidId: m.recipient_kid_id,
      lastMsg: m,
      isFromParent,
    });
  }

  if (folder.size === 0) return [];

  // Batch-fetch kid + family display info.
  const kidIds = Array.from(folder.values()).map((f) => f.kidId);
  const { data: kids, error: kidErr } = await supabase
    .from('kids')
    .select('id, first_name, last_name, family_id, family:families(id, parent_last_name)')
    .in('id', kidIds);
  if (kidErr) throw kidErr;

  const kidMap = new Map<string, KidFamilyRow>();
  for (const k of (kids ?? []) as unknown as KidFamilyRow[]) {
    kidMap.set(k.id, k);
  }

  const result: CoachInboxRow[] = [];
  for (const entry of folder.values()) {
    const kid = kidMap.get(entry.kidId);
    const m = entry.lastMsg;
    result.push({
      familyId: entry.familyId,
      familyLastName: kid?.family?.parent_last_name ?? '',
      kidId: entry.kidId,
      kidFirstName: kid?.first_name ?? 'Athlete',
      kidLastName: kid?.last_name ?? '',
      coachUserId,
      lastCreatedAt: m.created_at,
      lastMessageText: m.message_text,
      lastHasVideo: !!m.video_id,
      unread: entry.isFromParent && !m.viewed_at,
    });
  }

  // Sort by most recent message descending.
  result.sort((a, b) => b.lastCreatedAt.localeCompare(a.lastCreatedAt));
  return result;
}

/**
 * Bidirectional thread for a (kid, coach) pair — coach-side perspective.
 *
 * Unlike the parent-side `listMessageThread` (which uses `selfUserId` to
 * distinguish the parent arm of the `or` filter), this function correctly
 * fetches BOTH directions from the coach's point of view:
 *
 *   - coach→parent:  sender_user_id = coachUserId  (no recipient_coach_user_id)
 *   - parent→coach:  recipient_coach_user_id = coachUserId
 *
 * Both arms are scoped to `recipient_kid_id = kidId`. Sorted ascending so
 * the FlatList renders like a chat (oldest at top).
 *
 * Uses supabaseExt for the v0.7 extended columns.
 */
export type CoachThreadMessage = {
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

type CoachThreadJoinRow = {
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

function mapCoachThreadRow(r: CoachThreadJoinRow): CoachThreadMessage {
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

export async function listCoachMessageThread(opts: {
  kidId: string;
  coachUserId: string;
}): Promise<CoachThreadMessage[]> {
  const { kidId, coachUserId } = opts;
  const { data, error } = await supabaseExt
    .from('coach_messages')
    .select(
      'id, created_at, sender_user_id, recipient_family_id, recipient_kid_id, recipient_coach_user_id, message_text, label, sender_display, viewed_at, video:videos(id, status, mux_playback_id, duration_seconds, purpose)',
    )
    .eq('recipient_kid_id', kidId)
    .or(
      // arm 1: coach sent this message (coach→parent direction)
      // arm 2: parent sent this message TO this coach (parent→coach direction)
      `sender_user_id.eq.${coachUserId},recipient_coach_user_id.eq.${coachUserId}`,
    )
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as CoachThreadJoinRow[]).map(mapCoachThreadRow);
}
