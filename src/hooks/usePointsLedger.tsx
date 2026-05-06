import { useQuery } from '@tanstack/react-query';

import { listPointsLedger, type PointsLedgerEntry } from '@/api/earn';

export function usePointsLedger(kidId: string | null | undefined) {
  return useQuery<PointsLedgerEntry[]>({
    queryKey: ['points_ledger', kidId ?? 'none'],
    queryFn: () => listPointsLedger(kidId as string),
    enabled: !!kidId,
  });
}
