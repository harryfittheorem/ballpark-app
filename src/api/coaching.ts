import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const db = supabase as unknown as SupabaseClient;
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// Retain the key while retrying an unchanged submission after a lost response.
export function coachingRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}
export type ManualMeasurement = {
  id: string; booking_id: string; kid_id: string; location_id: string;
  recorded_by: string; recorded_on: string; created_at: string;
  average_ev: number; peak_ev: number; unit: 'mph' | 'km/h'; source: 'manual';
  replaces_id: string | null; correction_reason: string | null;
};
export type PrivateLessonNote = {
  id: string; booking_id: string; recorded_on: string; lesson_number: number;
  recorded_by: string; body: string; created_at: string;
};
export type GameInput = {
  played_on: string; at_bats: number; singles: number; doubles: number;
  triples: number; home_runs: number; strikeouts: number; walks: number;
  rbis: number; notes: string;
};
export type GameStat = GameInput & {
  id: string; kid_id: string; hits: number; source: 'self_reported'; created_at: string;
};
export type LessonRating = {
  booking_id: string; score: number; comment: string | null; submitted_coach_id: string; created_at: string;
};
export type StaffCoachingRecords = {
  measurements: ManualMeasurement[]; notes: PrivateLessonNote[]; games: GameStat[]; rating: LessonRating | null;
};
export type RateableLesson = {
  id: string; scheduled_start: string; scheduled_end: string; instructor: string;
  type_name: string; actual_coach_id: string; rating: LessonRating | null;
};
export type FamilyCoachingRecords = { games: GameStat[]; lessons: RateableLesson[] };

export async function getStaffCoachingRecords(bookingId: string): Promise<StaffCoachingRecords> {
  const records = await rpc<Omit<StaffCoachingRecords, 'rating'>>('get_staff_coaching_records', { p_booking: bookingId });
  // The scoped bundle must authorize the booking first. Rating SELECT has its
  // own roster/family RLS and must not use an administrative client.
  const { data, error } = await db.from('lesson_ratings')
    .select('booking_id,score,comment,submitted_coach_id,created_at')
    .eq('booking_id', bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return { ...records, rating: data as LessonRating | null };
}
export const getFamilyCoachingRecords = (kidId: string) =>
  rpc<FamilyCoachingRecords>('get_family_coaching_records', { p_kid: kidId });
export const saveManualMeasurement = (requestId: string, bookingId: string, input: {
  recorded_on: string; average_ev: number; peak_ev: number; unit: 'mph' | 'km/h';
  replaces_id?: string; correction_reason?: string;
}) => rpc<ManualMeasurement>('save_coaching_record', {
  p_request: requestId, p_kind: 'measurement', p_subject: bookingId, p_data: input,
});
export const savePrivateLessonNote = (requestId: string, bookingId: string, input: {
  recorded_on: string; lesson_number: number; body: string;
}) => rpc<PrivateLessonNote>('save_coaching_record', {
  p_request: requestId, p_kind: 'note', p_subject: bookingId, p_data: input,
});
export const saveGameStats = (requestId: string, kidId: string, input: GameInput) =>
  rpc<GameStat>('save_coaching_record', {
    p_request: requestId, p_kind: 'game', p_subject: kidId, p_data: input,
  });
export const rateLesson = (bookingId: string, score: number, comment: string) =>
  rpc<LessonRating>('rate_coaching_lesson', { p_booking: bookingId, p_score: score, p_comment: comment });

export type PhoneChecklist = {
  assignment_id: string; course_title: string; lesson_id: string; title: string;
  items: string[]; completed: boolean;
};
async function checklistRequest<T>(body?: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to access assigned checklists.');
  const base = process.env.EXPO_PUBLIC_PORTAL_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Phone checklists need EXPO_PUBLIC_PORTAL_URL configured.');
  const response = await fetch(`${base}/api/mobile/checklists`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Could not load or save checklists. Please retry.');
  return data;
}
export const getPhoneChecklists = () => checklistRequest<PhoneChecklist[]>();
export const completePhoneChecklist = (assignmentId: string, lessonId: string, checked: number[]) =>
  checklistRequest<{ ok: true }>({ assignmentId, lessonId, checked });
