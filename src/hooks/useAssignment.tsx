/**
 * useAssignment — single-row lookup for the assignment detail screens
 * (parent + coach). Returns null when the row is not visible to the
 * caller (RLS) or doesn't exist.
 */

import { useQuery } from '@tanstack/react-query';

import { getAssignment, type AssignmentWithRefs } from '@/api/assignments';

export function assignmentKey(id: string) {
  return ['assignment', id] as const;
}

export function useAssignment(id: string | null | undefined) {
  return useQuery<AssignmentWithRefs | null>({
    queryKey: id ? assignmentKey(id) : ['assignment', 'anonymous'],
    queryFn: () => getAssignment(id as string),
    enabled: !!id,
  });
}
