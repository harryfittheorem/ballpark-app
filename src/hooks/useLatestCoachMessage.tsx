/**
 * Latest coach message for a kid, backed by TanStack Query.
 *
 * Used by the parent's Home tab to render the "Today's video" card. The
 * query is disabled when there's no kid (e.g. before kid registration) so
 * we don't fire a request that the RLS policy would reject anyway.
 */

import { useQuery } from '@tanstack/react-query';

import {
  getLatestCoachMessageForKid,
  type LatestCoachMessage,
} from '@/api/coachMessages';

export function latestCoachMessageKey(kidId: string) {
  return ['coachMessages', 'latest', kidId] as const;
}

export function useLatestCoachMessage(
  kidId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  // Polling and focus-refetch are conditional on the caller asserting
  // they're the active consumer (HomeScreen passes `useIsFocused()`).
  // When defocused we keep the observer alive but with `enabled: false`
  // so cached data still renders (avoids a flash on tab switch) without
  // re-running the 60s timer or fetching on AppState foreground events.
  const enabled = !!kidId && (options.enabled ?? true);
  return useQuery<LatestCoachMessage | null, Error>({
    queryKey: kidId
      ? latestCoachMessageKey(kidId)
      : ['coachMessages', 'latest', 'none'],
    queryFn: () => getLatestCoachMessageForKid(kidId as string),
    enabled,
    // Step 4.14 — in-app polling. AppState is wired to TanStack's
    // focusManager in `src/lib/queryClient.ts`, so foreground events
    // trigger an immediate refetch without waiting the full 60s.
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: enabled,
    refetchOnReconnect: enabled,
  });
}
