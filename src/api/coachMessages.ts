/**
 * Coach messages API helpers.
 *
 * v0.4 Step 4.9 added the read-side helper for the recipient picker. Step 4.10
 * adds the write side (`sendCoachMessage`) plus a small `getVideo` lookup so
 * the Send Confirmation screen can poll for the Mux poster as soon as the
 * webhook flips status to `ready`.
 *
 * RLS already lets a coach SELECT every kid + family in their tenant via the
 * `kids_select_coach_stub` / `families_select_coach_stub` policies
 * (see 20260505040800_rename_role_to_app_role_in_jwt.sql), so this file
 * doesn't need to filter by tenant_id client-side on the read paths.
 *
 * For inserts, the coach_messages_insert_own_coach RLS policy
 * (see 20260505080000_v04_videos_coach_messages.sql) requires
 * `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid` AND
 * `sender_user_id = auth.uid()`. The client must therefore pass both —
 * tenant_id is supplied by the caller (read from `public.coaches.tenant_id`
 * via `useCoach`), and sender_user_id is taken from `useAuth().user.id`.
 */

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

/**
 * Flat row returned by `listTenantKids`, denormalised so the recipient
 * picker can render a row + group by family without an N+1 fetch.
 */
export type TenantKid = {
  kidId: string;
  firstName: string;
  lastName: string;
  ageGroup: string | null;
  avatarUrl: string | null;
  familyId: string;
  familyLastName: string;
  parentFirstName: string;
  parentLastName: string;
};

type KidWithFamilyRow = Pick<
  Tables<'kids'>,
  'id' | 'first_name' | 'last_name' | 'age_group' | 'avatar_url' | 'family_id'
> & {
  family:
    | Pick<
        Tables<'families'>,
        'id' | 'parent_first_name' | 'parent_last_name'
      >
    | null;
};

/**
 * Fetch every kid the coach can see (RLS scopes by tenant) along with the
 * family info needed to group + label rows. Sorted by family last name,
 * then kid first name — sorting happens client-side because PostgREST can't
 * `order` by an embedded resource's column.
 */
export async function listTenantKids(): Promise<TenantKid[]> {
  const { data, error } = await supabase
    .from('kids')
    .select(
      'id, first_name, last_name, age_group, avatar_url, family_id, family:families!inner(id, parent_first_name, parent_last_name)',
    );
  if (error) throw error;

  const rows = (data ?? []) as unknown as KidWithFamilyRow[];

  const mapped: TenantKid[] = rows
    .filter((r): r is KidWithFamilyRow & { family: NonNullable<KidWithFamilyRow['family']> } => !!r.family)
    .map((r) => ({
      kidId: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      ageGroup: r.age_group,
      avatarUrl: r.avatar_url,
      familyId: r.family.id,
      familyLastName: r.family.parent_last_name,
      parentFirstName: r.family.parent_first_name,
      parentLastName: r.family.parent_last_name,
    }));

  mapped.sort((a, b) => {
    const fam = a.familyLastName.localeCompare(b.familyLastName, undefined, {
      sensitivity: 'base',
    });
    if (fam !== 0) return fam;
    return a.firstName.localeCompare(b.firstName, undefined, {
      sensitivity: 'base',
    });
  });

  return mapped;
}

/**
 * Lightweight projection of `public.videos` used by the Send Confirmation
 * preview. We only need the lifecycle status + playback id (for the Mux
 * poster URL) + duration for an optional caption.
 */
export type VideoPreview = Pick<
  Tables<'videos'>,
  'id' | 'status' | 'mux_playback_id' | 'duration_seconds'
>;

/**
 * Fetch a single video row by id. Returns null when the row is not visible
 * to the caller (RLS) or doesn't exist; callers branch on null to render a
 * generic "couldn't load preview" state.
 */
export async function getVideo(videoId: string): Promise<VideoPreview | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, status, mux_playback_id, duration_seconds')
    .eq('id', videoId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Input shape for `sendCoachMessage`.
 *
 * `messageText` is normalised by the caller — pass `null` for an empty note
 * so the row's `message_text` column is NULL (not an empty string), which
 * keeps the UI's "video-only" detection trivial. tenant_id and
 * sender_user_id are looked up server-side from the current Supabase
 * session + the caller's `public.coaches` row, so callers can't accidentally
 * pass mismatched values that would trip the
 * coach_messages_insert_own_coach RLS policy.
 */
export type SendCoachMessageInput = {
  videoId: string;
  recipientFamilyId: string;
  recipientKidId: string;
  messageText: string | null;
};

export type SentCoachMessage = Tables<'coach_messages'>;

/**
 * Insert a row into `public.coach_messages`. Mirrors `createBooking` in
 * `bookings.ts` — relies on RLS to reject any attempt to smuggle a row
 * into another tenant or impersonate another sender.
 *
 * tenant_id is read from the caller's `public.coaches` row (single source
 * of truth on the client; the JWT also carries it but we already keep
 * `coaches.tenant_id` cached via `useCoach`). sender_user_id is taken from
 * `supabase.auth.getUser()` so the value matches what auth.uid() will
 * resolve to inside the RLS policy. We `.select().single()` so callers get
 * the freshly-inserted row (id + created_at) for cache priming on the
 * sent-videos list later.
 */
export async function sendCoachMessage(
  input: SendCoachMessageInput,
): Promise<SentCoachMessage> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('You appear to be signed out. Sign back in and try again.');

  const { data: coach, error: coachErr } = await supabase
    .from('coaches')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (coachErr) throw coachErr;
  if (!coach) throw new Error('Coach profile not found for the current user.');

  const { data, error } = await supabase
    .from('coach_messages')
    .insert({
      tenant_id: coach.tenant_id,
      sender_user_id: user.id,
      video_id: input.videoId,
      recipient_family_id: input.recipientFamilyId,
      recipient_kid_id: input.recipientKidId,
      message_text: input.messageText,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
