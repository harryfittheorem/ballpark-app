/**
 * Shared TanStack Query client.
 *
 * Mobile-friendly defaults: no window-focus refetching (RN has no real
 * window focus), modest retry, and conservative stale time. Exported as a
 * module-level singleton so non-React code (e.g. signOut) can call
 * `queryClient.clear()` to drop the previous account's cached data.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
