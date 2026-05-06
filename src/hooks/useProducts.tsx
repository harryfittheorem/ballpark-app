import { useQuery } from '@tanstack/react-query';

import { listProducts, type Product } from '@/api/earn';

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: listProducts,
  });
}
