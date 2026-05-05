/**
 * Family + kids hook.
 *
 * Fetches the parent's family row and their kids on session change.
 * Exposes a callback to insert a kid (RLS-protected by family_id).
 *
 * Lightweight hand-rolled state — we'll fold this into TanStack Query when
 * the broader data layer lands (v0.2). For Step 1.6 we just need to know
 * "does this family already have a kid?" so the root nav can decide between
 * AddKid and the tab shell.
 */

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/database';

import { useAuth } from './useAuth';

type Family = Tables<'families'>;
type Kid = Tables<'kids'>;

type FamilyState = {
  family: Family | null;
  kids: Kid[];
  loading: boolean;
  error: Error | null;
};

const initial: FamilyState = { family: null, kids: [], loading: true, error: null };

let memoState: FamilyState = initial;
const listeners = new Set<(s: FamilyState) => void>();
let activeUserId: string | null = null;

function setState(next: Partial<FamilyState>) {
  memoState = { ...memoState, ...next };
  listeners.forEach((l) => l(memoState));
}

async function refresh(userId: string) {
  setState({ loading: true, error: null });
  const { data: family, error: famErr } = await supabase
    .from('families')
    .select('*')
    .eq('parent_user_id', userId)
    .maybeSingle();

  if (famErr) {
    setState({ loading: false, error: famErr });
    return;
  }
  if (!family) {
    setState({ family: null, kids: [], loading: false });
    return;
  }
  const { data: kids, error: kidErr } = await supabase
    .from('kids')
    .select('*')
    .eq('family_id', family.id)
    .order('created_at', { ascending: true });

  if (kidErr) {
    setState({ family, kids: [], loading: false, error: kidErr });
    return;
  }
  setState({ family, kids: kids ?? [], loading: false });
}

export function useFamily() {
  const { user } = useAuth();
  const [state, setLocal] = useState<FamilyState>(memoState);

  useEffect(() => {
    listeners.add(setLocal);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      activeUserId = null;
      memoState = initial;
      setLocal(initial);
      return;
    }
    if (activeUserId !== user.id) {
      activeUserId = user.id;
      // Clear stale data from a previous account before async refresh so
      // we never render one user's family/kids under another user's session.
      memoState = { family: null, kids: [], loading: true, error: null };
      listeners.forEach((l) => l(memoState));
      void refresh(user.id);
    }
  }, [user]);

  return state;
}

export function useAddKid() {
  const { user } = useAuth();
  return useCallback(
    async (input: Omit<TablesInsert<'kids'>, 'family_id'>) => {
      if (!user) throw new Error('Not authenticated');
      // Family must exist (provisioned by handle_new_user). Re-fetch in case
      // it isn't in memo yet (e.g. directly after signup).
      let family = memoState.family;
      if (!family || family.parent_user_id !== user.id) {
        const { data, error } = await supabase
          .from('families')
          .select('*')
          .eq('parent_user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Family not found — auth hook may have failed');
        family = data;
      }
      const { error: insertErr } = await supabase
        .from('kids')
        .insert({ ...input, family_id: family.id });
      if (insertErr) throw insertErr;
      await refresh(user.id);
    },
    [user],
  );
}
