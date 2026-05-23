/**
 * Selected kid store — persists which kid is "active" across app restarts.
 *
 * When a family has multiple kids, the parent picks one via the kid
 * switcher pill. The selection is stored here (AsyncStorage-backed) and
 * consumed by `useSelectedKid`, which is the single source of truth for
 * "which kid's data am I showing right now?"
 *
 * If the stored id is not in the current kids list (kid deleted, first
 * install, etc.) `useSelectedKid` falls back to `kids[0]` and updates
 * this store to match.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'ballpark.selectedKidId';

type State = {
  selectedKidId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSelectedKid: (id: string | null) => void;
};

let hydratePromise: Promise<void> | null = null;

async function readStorage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeStorage(id: string | null): Promise<void> {
  try {
    if (id === null) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    // Best-effort; worst case is defaulting to kids[0] on next cold start.
  }
}

export const useSelectedKidStore = create<State>((set, get) => ({
  selectedKidId: null,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return Promise.resolve();
    if (hydratePromise) return hydratePromise;
    hydratePromise = readStorage().then((id) => {
      set({ selectedKidId: id, hydrated: true });
    });
    return hydratePromise;
  },
  setSelectedKid: (id) => {
    if (get().selectedKidId === id) return;
    set({ selectedKidId: id });
    void writeStorage(id);
  },
}));
