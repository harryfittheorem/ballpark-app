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
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

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
    // True while a background refetch is in flight (e.g. after adding a kid
    // and invalidating the query). Used by useSelectedKid to avoid premature
    // fallback to kids[0] before the new kid appears in the fetched list.
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
  };
}

export function useAddKid() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: AddKidInput) => {
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

      // If the parent picked a different home location at AddKid time,
      // persist that on the family row first so a kid insert that also
      // references the location stays consistent. No-op when the value
      // matches the trigger-set default.
      const { primary_location_id, ...kidFields } = input;
      if (
        primary_location_id !== undefined &&
        primary_location_id !== family.primary_location_id
      ) {
        const { error: famErr } = await supabase
          .from('families')
          .update({ primary_location_id })
          .eq('id', family.id);
        if (famErr) throw famErr;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('kids')
        .insert({ ...kidFields, family_id: family.id })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      // Return the new kid's id so callers (e.g. AddKidScreen) can pass an
      // explicit kidId into the post-AddKid HitTrax onboarding gate
      // instead of relying on `kids[0]` racing the family refetch.
      return { id: inserted.id };
    },
    onSuccess: () => {
      if (user) {
        void qc.invalidateQueries({ queryKey: familyKey(user.id) });
      }
    },
  });

  // Preserve the existing call signature: `await addKid(input)`.
  return useCallback(
    (input: AddKidInput) => mutation.mutateAsync(input),
    [mutation],
  );
}

type AddKidInput = Omit<TablesInsert<'kids'>, 'family_id'> & {
  primary_location_id?: string | null;
};

type EditKidInput = {
  kidId: string;
  first_name?: string | null;
  last_name?: string | null;
  age_group?: string | null;
  primary_position?: string | null;
  jersey_number?: number | null;
};

export function useEditKid() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ kidId, ...fields }: EditKidInput) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('kids')
        .update(fields as TablesUpdate<'kids'>)
        .eq('id', kidId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        void qc.invalidateQueries({ queryKey: familyKey(user.id) });
      }
    },
  });

  return useCallback(
    (input: EditKidInput) => mutation.mutateAsync(input),
    [mutation],
  );
}

export function useDeleteKid() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (kidId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('kids')
        .delete()
        .eq('id', kidId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        void qc.invalidateQueries({ queryKey: familyKey(user.id) });
      }
    },
  });

  return useCallback(
    (kidId: string) => mutation.mutateAsync(kidId),
    [mutation],
  );
}
