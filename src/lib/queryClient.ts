/**
 * Shared TanStack Query client.
 *
 * Mobile-friendly defaults: no window-focus refetching by default
 * (queries opt in individually), modest retry, and conservative stale
 * time. Exported as a module-level singleton so non-React code
 * (e.g. signOut) can call `queryClient.clear()` to drop the previous
 * account's cached data.
 *
 * AppState wiring: TanStack Query's web `focusManager` listens to the
 * browser `visibilitychange` event, which doesn't exist in React
 * Native. Without the bridge below, queries that opt into
 * `refetchOnWindowFocus: true` (e.g. `useLatestCoachMessage` for
 * Step 4.14's in-app coach-video polling) would never get the
 * "foreground after backgrounding" refetch the spec requires. The
 * listener returns a cleanup so it tears down cleanly during HMR.
 */

import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';

if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const onChange = (status: AppStateStatus) => {
      handleFocus(status === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  });
}

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
