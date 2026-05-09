/**
 * Achievements API helpers — catalog + per-kid earned log.
 *
 * The DB schema (migration 20260511000000) is the source of truth for
 * `achievements` and `kid_achievements`. Until the next type regen, the
 * supabase client is cast to `SupabaseClient` (the un-typed client) so
 * the table-name string literal compiles without `as any`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type Achievement = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  points_bonus: number;
  sort_order: number;
};

export type KidAchievement = {
  id: string;
  tenant_id: string;
  kid_id: string;
  achievement_id: string;
  earned_at: string;
};

const sb: SupabaseClient = supabase as unknown as SupabaseClient;

export async function listAchievements(): Promise<Achievement[]> {
  const { data, error } = await sb
    .from('achievements')
    .select('id, key, name, description, icon, points_bonus, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Achievement[];
}

export async function listEarnedForKid(kidId: string): Promise<KidAchievement[]> {
  const { data, error } = await sb
    .from('kid_achievements')
    .select('id, tenant_id, kid_id, achievement_id, earned_at')
    .eq('kid_id', kidId)
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KidAchievement[];
}
