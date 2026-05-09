/**
 * Train tab hooks (v0.7 task #121).
 *
 * Wraps the `training_videos` API in TanStack Query so the Train tab
 * gets caching, focus refetch, and pull-to-refresh for free. The
 * Continue Watching list is a separate hook because it reads from
 * AsyncStorage on the device, not from Supabase.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import {
  getTrainingVideo,
  listTrainingVideos,
  recordTrainingView,
  type TrainingVideo,
  type TrainingVideoCategory,
} from '@/api/trainingVideos';
import { readProgress, type TrainingProgressMap } from '@/store/trainingProgress';

export const trainingVideoKeys = {
  all: ['trainingVideos'] as const,
  list: (cat: TrainingVideoCategory | 'all') =>
    [...trainingVideoKeys.all, 'list', cat] as const,
  detail: (id: string) => [...trainingVideoKeys.all, 'detail', id] as const,
  progress: (kidId: string) => [...trainingVideoKeys.all, 'progress', kidId] as const,
};

export function useTrainingVideos(category: TrainingVideoCategory | 'all' = 'all') {
  return useQuery<TrainingVideo[]>({
    queryKey: trainingVideoKeys.list(category),
    queryFn: () =>
      listTrainingVideos(category === 'all' ? {} : { category }),
    staleTime: 60_000,
  });
}

export function useTrainingVideo(id: string | null | undefined) {
  return useQuery<TrainingVideo | null>({
    queryKey: id ? trainingVideoKeys.detail(id) : ['trainingVideos', 'detail', 'noop'],
    queryFn: () => (id ? getTrainingVideo(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

/**
 * Reads the AsyncStorage continue-watching map for a kid. Refresh is
 * exposed so the player can bump it after writing a new position. We
 * use plain useState (not React Query) because the source of truth is
 * device-local — there's no network round-trip to optimize.
 */
export function useTrainingProgress(kidId: string | null | undefined) {
  const [map, setMap] = useState<TrainingProgressMap>({});
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!kidId) {
      setMap({});
      setLoaded(true);
      return;
    }
    const next = await readProgress(kidId);
    setMap(next);
    setLoaded(true);
  }, [kidId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { map, loaded, refresh };
}

/**
 * Records a view via the SECURITY DEFINER RPC. The player throttles
 * via a useRef so a burst of expo-av status ticks only fires once per
 * playback session.
 */
export function useRecordTrainingView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, kidId }: { videoId: string; kidId: string }) =>
      recordTrainingView(videoId, kidId),
    onSuccess: (_data, { videoId }) => {
      // Bump the cached row so the player's view-count display reflects
      // the new total without a manual refresh.
      void qc.invalidateQueries({ queryKey: trainingVideoKeys.detail(videoId) });
      void qc.invalidateQueries({ queryKey: trainingVideoKeys.all });
    },
  });
}
