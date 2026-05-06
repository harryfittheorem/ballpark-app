/**
 * useReviewAssignment — coach mutation that calls the SECURITY DEFINER
 * `review_assignment` RPC and invalidates the per-tenant assignments
 * lists + the single-assignment cache so the Review tab and the
 * parent's detail screen re-render with the new rating.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reviewAssignment, type Assignment } from '@/api/assignments';

import { useCoach } from './useCoach';

export function useReviewAssignment() {
  const qc = useQueryClient();
  const { coach } = useCoach();
  const tenantId = coach?.tenant_id ?? null;

  return useMutation<
    Assignment,
    unknown,
    { assignmentId: string; rating: number; feedback: string | null }
  >({
    mutationFn: reviewAssignment,
    onSuccess: (_data, vars) => {
      if (tenantId) {
        qc.invalidateQueries({ queryKey: ['coachAssignments', tenantId] });
      }
      qc.invalidateQueries({ queryKey: ['assignment', vars.assignmentId] });
      // Parent-side per-kid list also changes; the row's kid_id isn't in
      // the variables so we invalidate the umbrella key (matches every
      // ['assignments', kidId]).
      qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}
