/**
 * Family + kids hook, backed by TanStack Query.
 *
 * One query per signed-in user (`['family', userId]`) fetches the family row
 * and, if present, the kids list in a single async function. Consumers get
 * the same `{ family, kids, loading, error }` shape they relied on before
 * the migration. `useAddKid` is a `useMutation` that invalidates the family
 * query on success so the kids list refreshes automatically.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/database';

import { useAuth } from './useAuth';

type Family = Tables<'families'>;
type Kid = Tables<'kids'>;

type FamilyData = {
  family: Family | null;
  kids: Kid[];
};

const EMPTY: FamilyData = { family: null, kids: [] };

function familyKey(userId: string) {
  return ['family', userId] as const;
}

async function fetchFamilyAndKids(userId: string): Promise<FamilyData> {
  const { data: family, error: famErr } = await supabase
    .from('families')
    .select('*')
    .eq('parent_user_id', userId)
    .maybeSingle();
  if (famErr) throw famErr;
  if (!family) return { family: null, kids: [] };

  const { data: kids, error: kidErr } = await supabase
    .from('kids')
    .select('*')
    .eq('family_id', family.id)
    .order('created_at', { ascending: true });
  if (kidErr) throw kidErr;

  return { family, kids: kids ?? [] };
}

export function useFamily() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: userId ? familyKey(userId) : ['family', 'anonymous'],
    queryFn: () => fetchFamilyAndKids(userId as string),
    enabled: !!userId,
  });

  const data = query.data ?? EMPTY;
  return {
    family: data.family,
    kids: data.kids,
    // When there's no user we resolve to the empty shape rather than
    // staying in a loading state.
    loading: !!userId && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}

export function useAddKid() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: Omit<TablesInsert<'kids'>, 'family_id'>) => {
      if (!user) throw new Error('Not authenticated');

      // Family must exist (provisioned by handle_new_user). Read from cache
      // when available, otherwise fetch fresh (e.g. directly after signup).
      const cached = qc.getQueryData<FamilyData>(familyKey(user.id));
      let family = cached?.family ?? null;
      if (!family) {
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
    },
    onSuccess: () => {
      if (user) {
        void qc.invalidateQueries({ queryKey: familyKey(user.id) });
      }
    },
  });

  // Preserve the existing call signature: `await addKid(input)`.
  return useCallback(
    (input: Omit<TablesInsert<'kids'>, 'family_id'>) => mutation.mutateAsync(input),
    [mutation],
  );
}
