/**
 * "Is the latest coach message new?" hook for Home-tab consumers.
 *
 * Composes `useAuth`, `useFamily`, and `useLatestCoachMessage` (the
 * polling query) with the persisted seen store. Used by HomeScreen and
 * the in-app `CoachMessageToast` — both of which only mount on the Home
 * tab, so the underlying `useQuery` observer (and its 60s
 * `refetchInterval`) is scoped exactly to where Step 4.14 wants polling
 * to happen.
 *
 * Side effects:
 *   - Pushes a snapshot `{id, viewedAt}` of the latest message into the
 *     coach-message-seen store on every change. The tab-bar badge in
 *     `MainTabNavigator` reads from that snapshot via
 *     `useCoachMessageBadge`, which mounts NO query observer — that's
 *     how we keep polling off non-Home tabs.
 *   - Lazy-init: first time a user sees data with no stored last-seen
 *     entry, marks the current message id as seen so messages that
 *     pre-date this code shipping don't pop a "new!" toast.
 *
 * A message is considered "new" when:
 *   - the latest-message query has resolved to a non-null row,
 *   - that row is not yet `viewed_at`-stamped, and
 *   - its id differs from the id we last marked seen for this user.
 */

import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import { useLatestCoachMessage } from '@/hooks/useLatestCoachMessage';
import {
  useCoachMessageSeenStore,
  useHydrateCoachMessageSeen,
} from '@/store/coachMessageSeen';

export function useNewCoachMessage() {
  useHydrateCoachMessageSeen();

  const { user } = useAuth();
  const { kids } = useFamily();
  const kid = kids[0];
  // Polling, focus refetch, and the isNew → toast effect must only run
  // while the Home tab is actually visible. `useIsFocused` returns true
  // for HomeMain when both the Home tab is selected AND the inner stack
  // is on HomeMain (not the VideoPlayback modal). When we lose focus,
  // the underlying query goes `enabled: false` so polling stops; cached
  // data still renders the CoachVideoCard so there's no flash on
  // re-focus.
  const isFocused = useIsFocused();
  // `isSuccess` is needed alongside `data` so lazy-init can fire on a
  // `null` first response too (the inbox-empty case).
  const { data: message, isSuccess: messageSettled } = useLatestCoachMessage(
    kid?.id,
    { enabled: isFocused },
  );

  const hydrated = useCoachMessageSeenStore((s) => s.hydrated);
  const initialized = useCoachMessageSeenStore((s) =>
    user ? user.id in s.seenByUser : false,
  );
  const lastSeen = useCoachMessageSeenStore((s) =>
    user ? s.seenByUser[user.id] : undefined,
  );
  const setLastSeen = useCoachMessageSeenStore((s) => s.setLastSeen);
  const setLatest = useCoachMessageSeenStore((s) => s.setLatest);

  // Push the current snapshot into the store so the tab-bar badge
  // (computed off store-only state) stays in sync without needing its
  // own query observer.
  useEffect(() => {
    if (!user) return;
    setLatest(
      user.id,
      message ? { id: message.id, viewedAt: message.viewedAt } : null,
    );
  }, [user, message, setLatest]);

  // Lazy-init: the very first time the query settles for this user with
  // no stored baseline, write a baseline so pre-existing messages don't
  // pop a "new!" toast. We persist the current message id when one
  // exists, or `null` (an "initialized but never notified" sentinel)
  // when the inbox is empty — that way the next message that arrives
  // for an empty-inbox user IS treated as new.
  useEffect(() => {
    if (!hydrated || !user || !messageSettled || initialized) return;
    setLastSeen(user.id, message ? message.id : null);
  }, [hydrated, user, messageSettled, initialized, message, setLastSeen]);

  const isNew =
    isFocused &&
    !!user &&
    hydrated &&
    initialized &&
    !!message &&
    message.viewedAt == null &&
    lastSeen !== message.id;

  return {
    isNew,
    message: isNew ? message : null,
    markSeen: () => {
      if (user && message) setLastSeen(user.id, message.id);
    },
  };
}

/**
 * Pure store-derived "should the Home tab show a badge?" selector.
 * Mounts NO query observer, so it's safe to call from
 * `MainTabNavigator` without keeping the 60s polling loop alive while
 * the parent is on a non-Home tab. The Home tab itself is responsible
 * for keeping the underlying snapshot fresh via `useNewCoachMessage`.
 */
export function useCoachMessageBadge(): boolean {
  useHydrateCoachMessageSeen();
  const { user } = useAuth();

  const hydrated = useCoachMessageSeenStore((s) => s.hydrated);
  const initialized = useCoachMessageSeenStore((s) =>
    user ? user.id in s.seenByUser : false,
  );
  const lastSeen = useCoachMessageSeenStore((s) =>
    user ? s.seenByUser[user.id] : undefined,
  );
  const latest = useCoachMessageSeenStore((s) =>
    user ? s.latestByUser[user.id] ?? null : null,
  );

  if (!user || !hydrated || !initialized || !latest) return false;
  if (latest.viewedAt != null) return false;
  return lastSeen !== latest.id;
}
