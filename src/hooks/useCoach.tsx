/**
 * Current coach hook — selects the row in `public.coaches` for the signed-in
 * user. Used by the coach landing screen to greet by first name.
 *
 * One query per signed-in user (`['coach', userId]`), enabled only when an
 * authenticated user exists. Returns `null` until the row resolves so callers
 * can fall back to a generic label instead of rendering "undefined".
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

import { useAuth } from './useAuth';

type Coach = Tables<'coaches'>;

export function coachKey(userId: string) {
  return ['coach', userId] as const;
}

async function fetchCoach(userId: string): Promise<Coach | null> {
  const { data, error } = await supabase
    .from('coaches')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export function useCoach() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: userId ? coachKey(userId) : ['coach', 'anonymous'],
    queryFn: () => fetchCoach(userId as string),
    enabled: !!userId,
  });

  return {
    coach: query.data ?? null,
    firstName: query.data?.first_name ?? null,
    lastName: query.data?.last_name ?? null,
    loading: !!userId && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}
