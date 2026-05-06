/**
 * useAssignments — list every assignment for a given kid (parent side).
 * Disabled until kidId is known so we don't fire an anonymous query.
 */

import { useQuery } from '@tanstack/react-query';

import { listAssignmentsForKid, type AssignmentWithRefs } from '@/api/assignments';

export function assignmentsKey(kidId: string) {
  return ['assignments', kidId] as const;
}

export function useAssignments(kidId: string | null | undefined) {
  return useQuery<AssignmentWithRefs[]>({
    queryKey: kidId ? assignmentsKey(kidId) : ['assignments', 'anonymous'],
    queryFn: () => listAssignmentsForKid(kidId as string),
    enabled: !!kidId,
  });
}
