/**
 * useRedeemReward — calls the SECURITY DEFINER `redeem_reward_for_kid` RPC
 * and invalidates the family + orders + ledger queries on success so the
 * Home HeroCard, the Earn rewards grid, and the order history all reflect
 * the new balance immediately.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { redeemReward, type RedeemResult } from '@/api/earn';

import { useAuth } from './useAuth';

export function useRedeemReward() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useMutation<RedeemResult, unknown, { kidId: string; productId: string }>({
    mutationFn: redeemReward,
    onSuccess: (_data, vars) => {
      // family query holds kids[].points_balance; HeroCard reads from there.
      if (userId) qc.invalidateQueries({ queryKey: ['family', userId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['points_ledger', vars.kidId] });
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
      // Inventory may have ticked down; refetch the catalogue.
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
