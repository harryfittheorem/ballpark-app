/**
 * Coach-message notification state store.
 *
 * Two pieces of per-user state live here:
 *
 *   - `seenByUser[userId]` — id of the most recent coach_message the parent
 *     has been shown a notification for. Persisted to AsyncStorage so the
 *     badge / toast doesn't re-appear for an old message every time the
 *     app is restarted.
 *
 *   - `latestByUser[userId]` — a tiny snapshot `{id, viewedAt}` of the
 *     most recent coach_message we know about for this user, pushed in by
 *     the Home tab whenever its `useLatestCoachMessage` query resolves.
 *     Volatile (not persisted). Lets the tab-bar badge be computed from
 *     pure store state instead of mounting another `useQuery` observer
 *     in `MainTabNavigator` — that would otherwise keep the 60s polling
 *     loop alive while the parent is on a non-Home tab, which Step 4.14
 *     explicitly forbids.
 *
 * Lazy initialization (Step 4.14): the very first time a snapshot is
 * pushed for a user with no stored seen entry, we mark whatever message
 * is currently latest as "seen" — so an existing message that pre-dates
 * this code shipping doesn't pop a "new!" toast the first time the
 * parent opens the app post-update.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

const STORAGE_KEY = 'coachMessageSeen.v1';

export type LatestSnapshot = {
  id: string;
  viewedAt: string | null;
};

/**
 * Per-user seen value. `string` = id of the most recent message the
 * parent was notified about. `null` = the user has been initialized
 * (we've observed a query result for them post-update) but hasn't been
 * notified about any message yet — i.e. the very first message that
 * arrives later should still trigger isNew. Absent key = not yet
 * initialized.
 */
type SeenValue = string | null;

type State = {
  seenByUser: Record<string, SeenValue>;
  latestByUser: Record<string, LatestSnapshot | null>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLastSeen: (userId: string, messageId: SeenValue) => void;
  setLatest: (userId: string, snapshot: LatestSnapshot | null) => void;
};

async function readStorage(): Promise<Record<string, SeenValue>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Keep string + null entries; defensively drop anything else so a
      // corrupted blob doesn't poison the store.
      const out: Record<string, SeenValue> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string' || v === null) out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

async function writeStorage(map: Record<string, SeenValue>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort persistence — the worst case is one stale "new" toast
    // after a cold start, which is preferable to crashing.
  }
}

let hydratePromise: Promise<void> | null = null;

export const useCoachMessageSeenStore = create<State>((set, get) => ({
  seenByUser: {},
  latestByUser: {},
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return Promise.resolve();
    if (hydratePromise) return hydratePromise;
    hydratePromise = readStorage().then((seenByUser) => {
      set({ seenByUser, hydrated: true });
    });
    return hydratePromise;
  },
  setLastSeen: (userId, messageId) => {
    const current = get().seenByUser;
    if (current[userId] === messageId) return;
    const next = { ...current, [userId]: messageId };
    set({ seenByUser: next });
    void writeStorage(next);
  },
  setLatest: (userId, snapshot) => {
    const current = get().latestByUser[userId] ?? null;
    if (
      current === snapshot ||
      (current &&
        snapshot &&
        current.id === snapshot.id &&
        current.viewedAt === snapshot.viewedAt)
    ) {
      return;
    }
    set({
      latestByUser: { ...get().latestByUser, [userId]: snapshot },
    });
  },
}));

/**
 * Convenience hook: kicks off hydration on first mount. Safe to call from
 * multiple components — `hydrate()` is idempotent and dedupes in-flight
 * reads via `hydratePromise`.
 */
export function useHydrateCoachMessageSeen() {
  const hydrate = useCoachMessageSeenStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
