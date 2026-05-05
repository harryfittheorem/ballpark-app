/**
 * Upcoming session hook, backed by TanStack Query.
 *
 * Fetches the next confirmed booking for a given kid: the earliest booking
 * with status='confirmed' and scheduled_start >= now(). Coach (first/last
 * name) and location (name) are joined in a single query so the Home card
 * has display-ready fields.
 *
 * RLS: queried as the signed-in parent. The bookings_select_own_family
 * policy already restricts to bookings whose kid belongs to the caller's
 * family, so no extra filter is needed beyond kid_id.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type UpcomingSession = {
  id: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  durationMinutes: number;
  coachName: string;
  locationName: string;
};

export function upcomingSessionKey(kidId: string) {
  return ['upcoming-session', kidId] as const;
}

async function fetchUpcomingSession(kidId: string): Promise<UpcomingSession | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
        id,
        scheduled_start,
        scheduled_end,
        coach:coaches!bookings_coach_id_fkey ( first_name, last_name ),
        location:locations!bookings_location_id_fkey ( name )
      `,
    )
    .eq('kid_id', kidId)
    .eq('status', 'confirmed')
    .gte('scheduled_start', nowIso)
    .order('scheduled_start', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Supabase typings model the joined relation as an array | object depending
  // on the FK shape; normalize to a single record for either case.
  const coachRaw = data.coach as
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
  const coach = Array.isArray(coachRaw) ? coachRaw[0] ?? null : coachRaw;

  const locationRaw = data.location as { name: string } | { name: string }[] | null;
  const location = Array.isArray(locationRaw) ? locationRaw[0] ?? null : locationRaw;

  // If the joined coach/location metadata is missing for any reason
  // (RLS, deleted row, etc.), treat as "no upcoming session" so the
  // card renders its clean empty state instead of a half-blank row.
  const coachName = coach ? `${coach.first_name} ${coach.last_name}`.trim() : '';
  const locationName = location?.name ?? '';
  if (!coachName || !locationName) return null;

  const start = new Date(data.scheduled_start);
  const end = new Date(data.scheduled_end);
  const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  return {
    id: data.id,
    scheduledStart: start,
    scheduledEnd: end,
    durationMinutes,
    coachName,
    locationName,
  };
}

export function useUpcomingSession(kidId: string | null | undefined) {
  const query = useQuery({
    queryKey: kidId ? upcomingSessionKey(kidId) : ['upcoming-session', 'none'],
    queryFn: () => fetchUpcomingSession(kidId as string),
    enabled: !!kidId,
  });

  return {
    session: query.data ?? null,
    loading: !!kidId && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}
