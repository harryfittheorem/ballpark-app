/**
 * useCompleteAssignment — calls the SECURITY DEFINER
 * `complete_assignment_for_kid` RPC and invalidates every query whose
 * data shifts as a result: the family (kids[].points_balance backs the
 * Home HeroCard), the per-kid assignments list, the single-assignment
 * cache, the per-kid points ledger (Earn → Recent activity), and the
 * tenant leaderboard (Earn → Ranks). Mirrors the v0.5
 * useRedeemReward shape.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { completeAssignment, type CompleteAssignmentResult } from '@/api/assignments';

import { useAuth } from './useAuth';

export function useCompleteAssignment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useMutation<CompleteAssignmentResult, unknown, { assignmentId: string; kidId: string }>({
    mutationFn: ({ assignmentId }) => completeAssignment(assignmentId),
    onSuccess: (_data, vars) => {
      if (userId) qc.invalidateQueries({ queryKey: ['family', userId] });
      qc.invalidateQueries({ queryKey: ['assignments', vars.kidId] });
      qc.invalidateQueries({ queryKey: ['assignment', vars.assignmentId] });
      qc.invalidateQueries({ queryKey: ['points_ledger', vars.kidId] });
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
