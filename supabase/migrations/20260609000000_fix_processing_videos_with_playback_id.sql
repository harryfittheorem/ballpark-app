-- Fix videos rows where mux_playback_id is set but status is still 'processing'.
-- mux_playback_id being non-null is the authoritative proof of Mux readiness;
-- status can lag when a webhook fires before a function is deployed or replays fail.
-- We do NOT touch rows with status='errored' — those are legitimately failed.

UPDATE public.videos
SET status = 'ready'
WHERE mux_playback_id IS NOT NULL
  AND status NOT IN ('ready', 'errored');
