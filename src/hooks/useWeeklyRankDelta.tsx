/**
 * useWeeklyRankDelta — returns how many ranks a kid has climbed (+) or
 * dropped (-) over the past 7 days within their own tenant.
 *
 * The reconstruction (reverse every points_ledger delta in the past 7
 * days, re-rank) requires reading every kid's recent ledger rows —
 * something the parent RLS on `points_ledger` correctly forbids. So the
 * computation lives in `get_kid_weekly_rank_delta(p_kid_id)`, a
 * SECURITY DEFINER RPC that pins to the JWT's tenant_id and the kid's
 * tenant_id; it returns just the single integer delta with no row
 * leakage.
 *
 * Returns null when the kid is outside the top-50 (matches RanksScreen).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Cast to the un-typed client (NOT `any`) until next type regen picks up
// the new `get_kid_weekly_rank_delta` RPC name from the migration.
const sb: SupabaseClient = supabase as unknown as SupabaseClient;

async function fetchWeeklyDelta(kidId: string): Promise<number | null> {
  const { data, error } = await sb.rpc('get_kid_weekly_rank_delta', {
    p_kid_id: kidId,
  });
  if (error) throw error;
  return (data as number | null) ?? null;
}

export function useWeeklyRankDelta(kidId: string | null | undefined) {
  return useQuery<number | null, Error>({
    queryKey: kidId ? ['leaderboard', 'delta', kidId] : ['leaderboard', 'delta', 'none'],
    queryFn: () => fetchWeeklyDelta(kidId as string),
    enabled: !!kidId,
    staleTime: 60 * 1000,
  });
}
