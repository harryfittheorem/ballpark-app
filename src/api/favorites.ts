/**
 * Swing favorites API helpers (task #119).
 *
 * The toggle goes through the SECURITY DEFINER RPC `toggle_swing_favorite`
 * so the kid_id + tenant_id pinning + ownership check happen in one
 * server round-trip and a malicious client can't favourite a swing from
 * another family. The RPC returns the new state (true = now favorited).
 *
 * Reads can use the table directly because RLS already scopes by
 * parent_user_id = auth.uid().
 */

import { supabase } from '@/lib/supabase';

/** Set of swing_ids currently favorited by the calling parent. */
export async function listFavoriteSwingIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('kid_swing_favorites')
    .select('swing_id');
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { swing_id: string }).swing_id));
}

/** Toggle. Returns true if the swing is now favorited, false otherwise. */
export async function toggleSwingFavorite(swingId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_swing_favorite', {
    p_swing_id: swingId,
  });
  if (error) throw error;
  return Boolean(data);
}
