-- v0.6 follow-up: persistent purpose tagging on videos.
--
-- Until now, the difference between a coach→family message video and a
-- coach-recorded drill demo was implicit (carried only via navigation
-- params + the assignments.drill_video_id FK). That's enough to drive UI
-- but it makes any direct query against `videos` purpose-blind. Add a
-- first-class column so callers can filter without joining through
-- coach_messages / assignments.

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'coach_message'
    CHECK (purpose IN ('coach_message', 'drill'));

CREATE INDEX IF NOT EXISTS idx_videos_tenant_purpose
  ON public.videos(tenant_id, purpose);

COMMENT ON COLUMN public.videos.purpose IS
  'What this video was uploaded for. coach_message = sent to a family in the inbox; drill = attached to (or attachable to) an assignments row. Set by mux-create-upload from the client''s purpose param; defaults to coach_message for back-compat with rows uploaded before v0.6.';
