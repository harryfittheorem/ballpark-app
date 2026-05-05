/**
 * Draft notes store.
 *
 * Tiny Zustand slice that keeps the optional note a coach is composing on
 * the SendConfirmation screen alive across navigation. Without this, tapping
 * **Back** to fix the recipient unmounts the confirmation screen and any
 * typed note disappears, which the v0.4 Step 4.10 spec explicitly forbids.
 *
 * Keyed by `videoId` so each in-flight send maintains its own draft and we
 * never bleed text from one upload into another. `clearDraft` is called on
 * a successful send so the next time the same video id is somehow revisited
 * we start fresh.
 */

import { create } from 'zustand';

type DraftNotesState = {
  drafts: Record<string, string>;
  setDraft: (videoId: string, text: string) => void;
  clearDraft: (videoId: string) => void;
};

export const useDraftNotesStore = create<DraftNotesState>((set) => ({
  drafts: {},
  setDraft: (videoId, text) =>
    set((state) => ({ drafts: { ...state.drafts, [videoId]: text } })),
  clearDraft: (videoId) =>
    set((state) => {
      if (!(videoId in state.drafts)) return state;
      const rest = { ...state.drafts };
      delete rest[videoId];
      return { drafts: rest };
    }),
}));

export function useDraftNote(videoId: string): [string, (text: string) => void] {
  const value = useDraftNotesStore((s) => s.drafts[videoId] ?? '');
  const setDraft = useDraftNotesStore((s) => s.setDraft);
  return [value, (text: string) => setDraft(videoId, text)];
}
