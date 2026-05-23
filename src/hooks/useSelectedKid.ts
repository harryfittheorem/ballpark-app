/**
 * useSelectedKid — the single source of truth for "which kid is active."
 *
 * Composes the persisted `selectedKidStore` with `useFamily` so that:
 *  - On first load, the store is hydrated from AsyncStorage.
 *  - If the stored kid id is not in the current kids list (deleted,
 *    first install, etc.) we fall back to `kids[0]` and persist that.
 *  - `setSelectedKid(id)` updates the store and AsyncStorage.
 *
 * All screens that scope data to a single kid should use this hook
 * instead of reading `kids[0]` directly.
 */

import { useEffect } from 'react';

import { useSelectedKidStore } from '@/store/selectedKid';

import { useFamily } from './useFamily';

export function useSelectedKid() {
  const { family, kids, loading, isFetching } = useFamily();
  const { selectedKidId, hydrated, hydrate, setSelectedKid } =
    useSelectedKidStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Once hydrated, reconcile the stored id with the actual kids list.
  // This handles: first install (no stored id), kid deleted, family
  // data finally loaded after a cold start.
  //
  // Guard: skip while `isFetching` so we don't prematurely fall back to
  // kids[0] when the list is stale mid-refetch (e.g. right after addKid
  // invalidates the family query but before the response arrives).
  useEffect(() => {
    if (!hydrated || loading || isFetching || kids.length === 0) return;
    const found = kids.some((k) => k.id === selectedKidId);
    if (!found) {
      setSelectedKid(kids[0].id);
    }
  }, [hydrated, loading, isFetching, kids, selectedKidId, setSelectedKid]);

  const kid =
    kids.find((k) => k.id === selectedKidId) ?? kids[0] ?? null;

  return {
    kid,
    kids,
    family,
    loading,
    selectedKidId: kid?.id ?? null,
    setSelectedKid,
  };
}
