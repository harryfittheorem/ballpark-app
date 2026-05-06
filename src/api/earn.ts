/**
 * Earn API helpers — products catalogue, orders history, points ledger,
 * leaderboard, and the redeem RPC wrapper.
 *
 * All tenant scoping is enforced by RLS in the v0.5 migration; client just
 * passes the kid/product ids and the database verifies ownership.
 */

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Product = Tables<'products'>;
export type Order = Tables<'orders'>;
export type PointsLedgerEntry = Tables<'points_ledger'>;

export type OrderWithProduct = Order & {
  product: Pick<Product, 'id' | 'name' | 'category' | 'image_url'> | null;
  kid: Pick<Tables<'kids'>, 'id' | 'first_name' | 'last_name'> | null;
};

export type LeaderboardEntry = {
  kidId: string;
  firstName: string;
  lastName: string;
  pointsBalance: number;
  rank: number;
};

/**
 * All active products visible to the caller's tenant. Sorted by sort_order
 * (matches the seed) so the Rewards / Store grids stay deterministic.
 */
export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Family order history. RLS narrows to the caller's family (or to all
 * tenant orders for coaches, but this hook is parent-only).
 */
export async function listOrders(): Promise<OrderWithProduct[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, tenant_id, family_id, kid_id, product_id, payment_method, amount_paid_points, amount_paid_cents, stripe_payment_intent_id, status, redemption_code, fulfilled_at, created_at, updated_at, product:products(id, name, category, image_url), kid:kids(id, first_name, last_name)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithProduct[];
}

/**
 * Per-kid points history (most-recent first). Includes both grants
 * (sessions, etc.) and spends (redemptions).
 */
export async function listPointsLedger(kidId: string): Promise<PointsLedgerEntry[]> {
  const { data, error } = await supabase
    .from('points_ledger')
    .select('*')
    .eq('kid_id', kidId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

/**
 * Live tenant leaderboard. Reads the kids table directly (RLS
 * `kids_select_tenant` returns every kid in the caller's tenant) and ranks
 * by points_balance desc. v0.5+ may move this to a nightly snapshot table.
 */
export async function listLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('kids')
    .select('id, first_name, last_name, points_balance')
    .order('points_balance', { ascending: false })
    .order('first_name', { ascending: true })
    .limit(50);
  if (error) throw error;
  let rank = 0;
  let prevPoints: number | null = null;
  let stride = 0;
  return (data ?? []).map((row) => {
    stride += 1;
    if (prevPoints === null || row.points_balance !== prevPoints) {
      rank = stride;
      prevPoints = row.points_balance;
    }
    return {
      kidId: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      pointsBalance: row.points_balance,
      rank,
    };
  });
}

export type RedeemResult = {
  orderId: string;
  redemptionCode: string;
  newBalance: number;
};

/**
 * Wraps the `redeem_reward_for_kid` RPC. Server-side it locks the kid +
 * product rows, verifies ownership, decrements the balance, and inserts
 * the order + ledger row atomically. Throws on insufficient points,
 * inactive product, or wrong tenant — the API layer just forwards the
 * Postgres error message up.
 */
export async function redeemReward(input: {
  kidId: string;
  productId: string;
}): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_reward_for_kid', {
    p_kid_id: input.kidId,
    p_product_id: input.productId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Redemption returned no row');
  return {
    orderId: row.order_id,
    redemptionCode: row.redemption_code,
    newBalance: row.new_balance,
  };
}
