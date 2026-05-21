/**
 * bookingLocation store — session-only active location for the Book tab.
 *
 * The Book tab shows coaches and availability for one location at a time.
 * By default that location is the family's primary_location_id. When
 * `allow_cross_location_booking = true` in tenant_config, the user may
 * switch to a different location for the current session without changing
 * their home location.
 *
 * Intentionally NOT persisted to AsyncStorage — the session context resets
 * on app restart so the user always starts from their primary location.
 *
 * AUTH TRANSITIONS: The store subscribes to Supabase onAuthStateChange at
 * module initialisation time. On SIGNED_OUT or when a different user signs
 * in, activeLocationId is reset to null so the new user's primary location
 * is used rather than a stale value from the previous session.
 */

import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type BookingLocationState = {
  activeLocationId: string | null;
  setActiveLocationId: (id: string) => void;
  resetToDefault: () => void;
};

export const useBookingLocationStore = create<BookingLocationState>((set) => ({
  activeLocationId: null,

  setActiveLocationId: (id) => set({ activeLocationId: id }),

  resetToDefault: () => set({ activeLocationId: null }),
}));

// ---------------------------------------------------------------------------
// Auth state listener — reset on sign-out or user change.
// Runs once at module import time (singleton subscription).
// ---------------------------------------------------------------------------
let _lastUserId: string | null = null;

supabase.auth.onAuthStateChange((event, session) => {
  const store = useBookingLocationStore.getState();
  if (event === 'SIGNED_OUT') {
    _lastUserId = null;
    store.resetToDefault();
  } else if (session?.user?.id && session.user.id !== _lastUserId) {
    // A different user signed in — discard any stale location from the
    // previous session. The same user's TOKEN_REFRESHED keeps activeLocationId.
    _lastUserId = session.user.id;
    store.resetToDefault();
  }
});
