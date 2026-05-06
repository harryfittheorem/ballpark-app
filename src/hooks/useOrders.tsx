import { useQuery } from '@tanstack/react-query';

import { listOrders, type OrderWithProduct } from '@/api/earn';

import { useFamily } from './useFamily';

export function useOrders() {
  const { family } = useFamily();
  const familyId = family?.id ?? null;
  return useQuery<OrderWithProduct[]>({
    queryKey: ['orders', familyId],
    queryFn: listOrders,
    enabled: !!familyId,
  });
}
