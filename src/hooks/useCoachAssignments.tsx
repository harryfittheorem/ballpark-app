/**
 * useCoachAssignments — tenant-wide assignments list for the coach side.
 * Optional status filter narrows to e.g. 'submitted' for the Review tab.
 */

import { useQuery } from '@tanstack/react-query';

import {
  listAssignmentsForCoach,
  type AssignmentStatus,
  type AssignmentWithRefs,
} from '@/api/assignments';

import { useCoach } from './useCoach';

export function coachAssignmentsKey(tenantId: string, status?: AssignmentStatus) {
  return status
    ? (['coachAssignments', tenantId, status] as const)
    : (['coachAssignments', tenantId, 'all'] as const);
}

export function useCoachAssignments(status?: AssignmentStatus) {
  const { coach } = useCoach();
  const tenantId = coach?.tenant_id ?? null;

  return useQuery<AssignmentWithRefs[]>({
    queryKey: tenantId
      ? coachAssignmentsKey(tenantId, status)
      : ['coachAssignments', 'anonymous'],
    queryFn: () => listAssignmentsForCoach(status),
    enabled: !!tenantId,
  });
}
