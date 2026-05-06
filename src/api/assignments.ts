/**
 * Assignments API helpers for v0.6 Work.
 *
 * Reads use direct PostgREST against `public.assignments`; RLS narrows to
 * the caller's own family (parent) or the whole tenant (coach). Writes
 * that change state (`completeAssignment`, `reviewAssignment`) go through
 * SECURITY DEFINER RPCs so the points credit + state transition are
 * atomic and idempotent at the database level.
 *
 * `createAssignment` is a direct INSERT — RLS on assignments enforces
 * coach role + tenant pinning + cross-tenant FK smuggling defense, so
 * the client just supplies the row.
 */

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/database';

export type Assignment = Tables<'assignments'>;
export type AssignmentStatus = Assignment['status'];

/**
 * Assignment row joined with the optional drill video (status + Mux
 * playback id) and the recipient kid label. Keeps the detail screen + the
 * coach Review list to a single fetch.
 */
export type AssignmentWithRefs = Assignment & {
  drill_video: Pick<Tables<'videos'>, 'id' | 'status' | 'mux_playback_id' | 'duration_seconds'> | null;
  kid: Pick<Tables<'kids'>, 'id' | 'first_name' | 'last_name'> | null;
};

const ASSIGNMENT_WITH_REFS_SELECT =
  '*, drill_video:videos(id, status, mux_playback_id, duration_seconds), kid:kids(id, first_name, last_name)';

/**
 * List every assignment for the given kid, newest first. RLS already
 * restricts SELECT to the parent's own kids, but we filter explicitly so
 * the planner uses idx_assignments_kid_status when status is supplied
 * separately by the caller.
 */
export async function listAssignmentsForKid(kidId: string): Promise<AssignmentWithRefs[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_WITH_REFS_SELECT)
    .eq('kid_id', kidId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AssignmentWithRefs[];
}

/**
 * Single assignment lookup. Returns null when the row isn't visible (RLS)
 * or doesn't exist, so callers can render a friendly "not found" state.
 */
export async function getAssignment(id: string): Promise<AssignmentWithRefs | null> {
  const { data, error } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_WITH_REFS_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as AssignmentWithRefs | null;
}

/**
 * List assignments owned by the caller (the coach who created them),
 * optionally filtered by status. We filter by `coach_user_id = auth.uid()`
 * client-side so the Review queue only surfaces drills the caller is
 * actually authorized to review — `review_assignment` is restricted to
 * the owning coach (see 20260506100300_v06_review_assignment_owning_coach_fix.sql),
 * so showing tenant-wide submitted rows would just produce avoidable
 * RPC failures in multi-coach tenants.
 *
 * RLS still scopes by tenant; the coach_user_id filter is an additional
 * narrowing so the UI matches the RPC's authorization contract.
 */
export async function listAssignmentsForCoach(
  status?: AssignmentStatus,
): Promise<AssignmentWithRefs[]> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Not authenticated');

  let q = supabase
    .from('assignments')
    .select(ASSIGNMENT_WITH_REFS_SELECT)
    .eq('coach_user_id', user.id)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AssignmentWithRefs[];
}

/**
 * Input shape for `createAssignment`. tenant_id + coach_user_id are
 * derived server-side from the caller's session + `public.coaches` row,
 * so callers can't smuggle mismatched values past the RLS WITH CHECK.
 */
export type CreateAssignmentInput = {
  kidId: string;
  familyId: string;
  title: string;
  description: string | null;
  drillVideoId: string | null;
  durationEstimateMinutes: number | null;
  dueDate: string | null; // ISO date (YYYY-MM-DD)
  pointReward: number;
};

/**
 * Insert a new assignment. Looks up the caller's tenant_id from
 * `public.coaches` so the RLS tenant pin matches. Returns the freshly
 * inserted row (with refs hydrated) so the caller can prime its TanStack
 * Query cache without a re-fetch.
 */
export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<AssignmentWithRefs> {
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

  const row: TablesInsert<'assignments'> = {
    tenant_id: coach.tenant_id,
    coach_user_id: user.id,
    kid_id: input.kidId,
    family_id: input.familyId,
    title: input.title,
    description: input.description,
    drill_video_id: input.drillVideoId,
    duration_estimate_minutes: input.durationEstimateMinutes,
    due_date: input.dueDate,
    point_reward: input.pointReward,
  };

  const { data, error } = await supabase
    .from('assignments')
    .insert(row)
    .select(ASSIGNMENT_WITH_REFS_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as AssignmentWithRefs;
}

export type CompleteAssignmentResult = {
  assignmentId: string;
  newBalance: number;
  pointsCredited: number;
};

/**
 * Wraps the `complete_assignment_for_kid` RPC. Server-side it locks the
 * assignment row, verifies ownership + status, flips status to
 * 'submitted', credits the configured points, and inserts the ledger
 * row. Idempotent via partial unique index on points_ledger.
 */
export async function completeAssignment(
  assignmentId: string,
): Promise<CompleteAssignmentResult> {
  const { data, error } = await supabase.rpc('complete_assignment_for_kid', {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Completion returned no row');
  return {
    assignmentId: row.assignment_id,
    newBalance: row.new_balance,
    pointsCredited: row.points_credited,
  };
}

/**
 * Wraps the `review_assignment` RPC. Coach-only; flips status to
 * 'reviewed' with rating + feedback. Returns the updated row so the
 * coach UI can re-render without a re-fetch.
 */
export async function reviewAssignment(input: {
  assignmentId: string;
  rating: number;
  feedback: string | null;
}): Promise<Assignment> {
  const { data, error } = await supabase.rpc('review_assignment', {
    p_assignment_id: input.assignmentId,
    p_rating: input.rating,
    p_feedback: input.feedback ?? '',
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Review returned no row');
  return row as Assignment;
}
