/**
 * Training video catalog API (v0.7 task #121).
 *
 * `training_videos` is HQ-curated and tenant-scoped. RLS lets every
 * authenticated user in the tenant SELECT published rows; only admins can
 * insert/update/delete. Per-kid view logging goes through the
 * `record_training_view` SECURITY DEFINER RPC which dedupes server-side
 * (≤ 1 view_count bump per kid+video per 30 minutes) so the client cannot
 * inflate counts even by retrying.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// `training_videos` and `record_training_view` were added in migrations
// 20260510000000 / 20260510000001 and are not in the regenerated `Database`
// types yet (same caveat as v0.7 task #120 noted in replit.md). Casting
// to the un-typed `SupabaseClient` (rather than `any`) preserves method
// signatures and return-type inference for everything except the table
// name string literal — `scripts/post-merge.sh` regens the typed client
// after the migration runs in CI.
const sb = supabase as unknown as SupabaseClient;

export type TrainingVideoCategory = 'hitting' | 'mental' | 'situational' | 'fielding';
export type TrainingVideoLevel = 'beginner' | 'intermediate' | 'advanced';

export const TRAINING_CATEGORIES: { value: TrainingVideoCategory; label: string }[] = [
  { value: 'hitting',     label: 'Hitting' },
  { value: 'mental',      label: 'Mental' },
  { value: 'situational', label: 'Situational' },
  { value: 'fielding',    label: 'Fielding' },
];

export type TrainingVideo = {
  id: string;
  tenantId: string;
  muxPlaybackId: string;
  title: string;
  description: string | null;
  category: TrainingVideoCategory;
  level: TrainingVideoLevel;
  coachName: string | null;
  durationSec: number | null;
  viewCount: number;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
};

const COLUMNS =
  'id, tenant_id, mux_playback_id, title, description, category, level, coach_name, duration_sec, view_count, featured, published_at, created_at';

type Row = {
  id: string;
  tenant_id: string;
  mux_playback_id: string;
  title: string;
  description: string | null;
  category: TrainingVideoCategory;
  level: TrainingVideoLevel;
  coach_name: string | null;
  duration_sec: number | null;
  view_count: number;
  featured: boolean;
  published_at: string | null;
  created_at: string;
};

function toCamel(r: Row): TrainingVideo {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    muxPlaybackId: r.mux_playback_id,
    title: r.title,
    description: r.description,
    category: r.category,
    level: r.level,
    coachName: r.coach_name,
    durationSec: r.duration_sec,
    viewCount: r.view_count,
    featured: r.featured,
    publishedAt: r.published_at,
    createdAt: r.created_at,
  };
}

/**
 * List published training videos. Optionally filter by category. Tenant
 * scope is enforced by RLS — we never pass tenant_id from the client.
 */
export async function listTrainingVideos(
  opts: { category?: TrainingVideoCategory } = {},
): Promise<TrainingVideo[]> {
  let q = sb
    .from('training_videos')
    .select(COLUMNS)
    .not('published_at', 'is', null)
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false });
  if (opts.category) q = q.eq('category', opts.category);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toCamel);
}

/** Single fetch for the player screen. */
export async function getTrainingVideo(id: string): Promise<TrainingVideo | null> {
  const { data, error } = await sb
    .from('training_videos')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toCamel(data as unknown as Row) : null;
}

/**
 * Fire-and-forget view logger. The SECURITY DEFINER RPC dedupes
 * server-side (≤ 1 increment per kid+video per 30 minutes). The
 * client's useRef gate in TrainingVideoPlayerScreen is defence in
 * depth, not the source of correctness.
 */
export async function recordTrainingView(videoId: string, kidId: string): Promise<void> {
  const { error } = await sb.rpc('record_training_view', {
    p_video_id: videoId,
    p_kid_id: kidId,
  });
  if (error) throw error;
}
