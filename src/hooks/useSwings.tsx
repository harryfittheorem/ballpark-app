/**
 * Swings + sessions + favorites + personal-bests query hooks (task #119).
 *
 * All hooks are guarded by `kidId` truthiness so they no-op cleanly before
 * the kid record loads (RLS would reject anyway, but skipping the request
 * avoids a flash of error UI on first paint).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listFavoriteSwingIds, toggleSwingFavorite } from '@/api/favorites';
import { getSession, listSessionsForKid, type Session } from '@/api/sessions';
import {
  getLatestPersonalBestForKid,
  getSwing,
  listPersonalBestsForKid,
  listSwingsForKid,
  listSwingsForSession,
  type PersonalBest,
  type Swing,
} from '@/api/swings';

export const swingsKeys = {
  all: ['swings'] as const,
  byKid: (kidId: string) => ['swings', 'kid', kidId] as const,
  bySession: (sessionId: string) => ['swings', 'session', sessionId] as const,
  one: (swingId: string) => ['swings', 'one', swingId] as const,
};

export const sessionsKeys = {
  all: ['sessions'] as const,
  byKid: (kidId: string) => ['sessions', 'kid', kidId] as const,
  one: (sessionId: string) => ['sessions', 'one', sessionId] as const,
};

export const personalBestsKeys = {
  byKid: (kidId: string) => ['personalBests', 'kid', kidId] as const,
  latestByKid: (kidId: string) => ['personalBests', 'latest', kidId] as const,
};

export const favoritesKeys = {
  all: ['favorites'] as const,
};

export function useSwingsForKid(kidId: string | null | undefined) {
  return useQuery<Swing[], Error>({
    queryKey: kidId ? swingsKeys.byKid(kidId) : ['swings', 'kid', 'none'],
    queryFn: () => listSwingsForKid(kidId as string),
    enabled: !!kidId,
  });
}

export function useSwingsForSession(sessionId: string | null | undefined) {
  return useQuery<Swing[], Error>({
    queryKey: sessionId ? swingsKeys.bySession(sessionId) : ['swings', 'session', 'none'],
    queryFn: () => listSwingsForSession(sessionId as string),
    enabled: !!sessionId,
  });
}

export function useSwing(swingId: string | null | undefined) {
  return useQuery<Swing | null, Error>({
    queryKey: swingId ? swingsKeys.one(swingId) : ['swings', 'one', 'none'],
    queryFn: () => getSwing(swingId as string),
    enabled: !!swingId,
  });
}

export function useSessionsForKid(kidId: string | null | undefined) {
  return useQuery<Session[], Error>({
    queryKey: kidId ? sessionsKeys.byKid(kidId) : ['sessions', 'kid', 'none'],
    queryFn: () => listSessionsForKid(kidId as string),
    enabled: !!kidId,
  });
}

export function useSession(sessionId: string | null | undefined) {
  return useQuery<Session | null, Error>({
    queryKey: sessionId ? sessionsKeys.one(sessionId) : ['sessions', 'one', 'none'],
    queryFn: () => getSession(sessionId as string),
    enabled: !!sessionId,
  });
}

export function usePersonalBestsForKid(kidId: string | null | undefined) {
  return useQuery<PersonalBest[], Error>({
    queryKey: kidId ? personalBestsKeys.byKid(kidId) : ['personalBests', 'kid', 'none'],
    queryFn: () => listPersonalBestsForKid(kidId as string),
    enabled: !!kidId,
  });
}

export function useLatestPersonalBest(kidId: string | null | undefined) {
  return useQuery<PersonalBest | null, Error>({
    queryKey: kidId
      ? personalBestsKeys.latestByKid(kidId)
      : ['personalBests', 'latest', 'none'],
    queryFn: () => getLatestPersonalBestForKid(kidId as string),
    enabled: !!kidId,
  });
}

export function useFavoriteSwingIds() {
  return useQuery<Set<string>, Error>({
    queryKey: favoritesKeys.all,
    queryFn: listFavoriteSwingIds,
  });
}

/**
 * Optimistic toggle. We mutate the local Set immediately so the heart on
 * Swing Detail / the Favorites grid never lags behind the tap, then
 * reconcile against the server's authoritative boolean. On failure we
 * roll back via the snapshot saved in `onMutate`.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation<boolean, Error, string, { previous: Set<string> | undefined }>({
    mutationFn: (swingId: string) => toggleSwingFavorite(swingId),
    onMutate: async (swingId) => {
      await qc.cancelQueries({ queryKey: favoritesKeys.all });
      const previous = qc.getQueryData<Set<string>>(favoritesKeys.all);
      const next = new Set(previous ?? []);
      if (next.has(swingId)) next.delete(swingId);
      else next.add(swingId);
      qc.setQueryData<Set<string>>(favoritesKeys.all, next);
      return { previous };
    },
    onError: (_err, _swingId, ctx) => {
      if (ctx?.previous) qc.setQueryData(favoritesKeys.all, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });
}
