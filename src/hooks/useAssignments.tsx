/**
 * useAssignments — list assignments for a given kid (parent side).
 * Disabled until kidId is known so we don't fire an anonymous query.
 *
 * `statuses` optionally narrows server-side (e.g. Home only needs
 * 'pending' rows for its summary card; Work loads everything for its
 * sectioned list). The query key includes the filter so the two surfaces
 * share invalidation but keep separate cache slots.
 */

import { useQuery } from '@tanstack/react-query';

import { listAssignmentsForKid, type AssignmentStatus, type AssignmentWithRefs } from '@/api/assignments';

export function assignmentsKey(kidId: string, statuses?: AssignmentStatus[]) {
  const suffix = statuses && statuses.length > 0 ? [...statuses].sort().join(',') : 'all';
  return ['assignments', kidId, suffix] as const;
}

export function useAssignments(
  kidId: string | null | undefined,
  statuses?: AssignmentStatus[],
) {
  return useQuery<AssignmentWithRefs[]>({
    queryKey: kidId ? assignmentsKey(kidId, statuses) : ['assignments', 'anonymous'],
    queryFn: () => listAssignmentsForKid(kidId as string, statuses),
    enabled: !!kidId,
  });
}
