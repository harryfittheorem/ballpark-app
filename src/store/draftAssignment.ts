/**
 * Draft assignment store.
 *
 * Keeps the in-progress drill the coach is composing on
 * CreateAssignmentScreen alive across navigation AND across full Expo Go
 * memory terminations.
 *
 * Why this exists: launching the system camera for a long video clip
 * (`ImagePicker.launchCameraAsync` from RecordVideoScreen with
 * `purpose: 'drill_assignment'`) routinely makes iOS reclaim the Expo
 * Go JS process to free RAM. When the app comes back, React Navigation
 * restores the route params (so `drillVideoId` survives via the merged
 * navigation param), but every screen's local `useState` is reset — so
 * the title / kid / notes / due date the coach already typed disappear.
 * The user sees what looks like a fresh CreateAssignment with the drill
 * video pre-attached. Reported by the user as "it refreshed the whole
 * drill, so I had to retype everything."
 *
 * Same pattern as `draftNotes.ts` (which solves the same problem for the
 * SendConfirmation note). Single global slot — there is only ever one
 * drill being composed at a time. Cleared on successful create AND on
 * Cancel so a future visit always starts blank unless the coach truly
 * abandoned mid-flow.
 *
 * Persisted to AsyncStorage so the draft survives a full process kill.
 * Hydration is lazy on first read; while loading the store returns
 * `null` (= no draft), which CreateAssignment treats as "use defaults".
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'draftAssignment.v1';

export type DraftAssignment = {
  selectedKidId: string | null;
  title: string;
  description: string;
  duration: string;
  dueDate: string;
  points: string;
  drillVideoId: string | null;
};

type DraftAssignmentState = {
  draft: DraftAssignment | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDraft: (patch: Partial<DraftAssignment>) => void;
  clearDraft: () => void;
};

export const useDraftAssignmentStore = create<DraftAssignmentState>((set, get) => ({
  draft: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      // If the user already started typing in this session before
      // AsyncStorage resolved, `draft` will be non-null. Don't clobber
      // their fresh edits with a stale persisted blob — the in-memory
      // values are newer and will be re-persisted on the next setDraft.
      if (raw && get().draft === null) {
        const parsed = JSON.parse(raw) as DraftAssignment;
        set({ draft: parsed, hydrated: true });
        return;
      }
    } catch {
      // Corrupt JSON or AsyncStorage failure — fall through to empty draft.
    }
    set({ hydrated: true });
  },
  setDraft: (patch) => {
    const next: DraftAssignment = {
      selectedKidId: null,
      title: '',
      description: '',
      duration: '15',
      dueDate: '',
      points: '25',
      drillVideoId: null,
      ...(get().draft ?? {}),
      ...patch,
    };
    set({ draft: next });
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      /* best-effort persistence */
    });
  },
  clearDraft: () => {
    set({ draft: null });
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {
      /* best-effort */
    });
  },
}));
