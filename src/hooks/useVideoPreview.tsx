/**
 * Polls a single video row until Mux finishes processing.
 *
 * The Send Confirmation screen needs to swap a "Processing video…" placeholder
 * for the real Mux poster as soon as the `mux-webhook` Edge Function flips
 * `videos.status` to `ready`. We poll every 5 seconds until status is a
 * terminal value (`ready` or `errored`); after that the interval is disabled
 * so we don't keep hammering the database.
 */

import { useQuery } from '@tanstack/react-query';

import { getVideo, type VideoPreview } from '@/api/coachMessages';

const POLL_INTERVAL_MS = 5_000;

export function videoPreviewKey(videoId: string) {
  return ['video', 'preview', videoId] as const;
}

export function useVideoPreview(videoId: string | null) {
  return useQuery<VideoPreview | null, Error>({
    queryKey: videoId ? videoPreviewKey(videoId) : ['video', 'preview', 'none'],
    queryFn: () => getVideo(videoId as string),
    enabled: !!videoId,
    // Poll while Mux is still processing; stop once we hit a terminal status.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      if (data.status === 'ready' || data.status === 'errored') return false;
      return POLL_INTERVAL_MS;
    },
    // The cached value can stay fresh for a moment so navigating back to the
    // screen doesn't refetch immediately.
    staleTime: 2_000,
  });
}
