-- =============================================================================
-- v0.7 task #121 — Training video library FOLLOW-UP (code review fixes)
-- =============================================================================
-- 1) Extend videos.purpose CHECK with 'training' so admin Train uploads can
--    persist into public.videos via mux-create-upload (purpose='training').
-- 2) Replace record_training_view with a server-side dedupe so view_count
--    increments AT MOST ONCE per (kid, video) per 30-minute window — the
--    client-side useRef gate is now defence in depth, not the only line.
-- =============================================================================

-- 1. videos.purpose ----------------------------------------------------------
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_purpose_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_purpose_check
  CHECK (purpose IN ('coach_message', 'drill', 'parent_to_coach', 'training'));

COMMENT ON COLUMN public.videos.purpose IS
  'What this video was uploaded for. coach_message | drill | parent_to_coach | training. Set by mux-create-upload from the client''s purpose param; training is admin-only (v0.7 task #121).';


-- 1a. Admin SELECT on public.videos for training uploads ---------------------
-- mux-create-upload INSERTs the videos row with the service role (bypasses
-- RLS) but the portal admin then needs to SELECT mux_playback_id once the
-- mux-webhook fills it in (poll loop in TrainingVideoUploadField). Without
-- this policy admins read 0 rows under RLS and the auto-fill never resolves.
-- Scoped to the admin's tenant AND purpose='training' for least privilege.
DROP POLICY IF EXISTS videos_select_admin_training ON public.videos;
CREATE POLICY videos_select_admin_training ON public.videos
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
    AND purpose = 'training'
  );


-- 2. record_training_view: server-side per-session dedupe --------------------
-- Drop the prior signature first; CREATE OR REPLACE cannot change return type.
DROP FUNCTION IF EXISTS public.record_training_view(uuid, uuid);

-- A "session" for analytics is "this kid hasn't viewed this video in the
-- last 30 minutes". Repeated calls within the window are no-ops — the
-- view row is NOT inserted and view_count is NOT bumped. This guarantees
-- the once-per-session semantics even if the client retries / remounts /
-- bypasses its in-memory throttle.
CREATE OR REPLACE FUNCTION public.record_training_view(
  p_video_id uuid,
  p_kid_id   uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_kid_tenant  uuid;
  v_caller_role text := (auth.jwt() ->> 'app_role');
  v_caller_tnt  uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_recent      boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT tv.tenant_id INTO v_tenant_id
  FROM public.training_videos tv
  WHERE tv.id = p_video_id
    AND tv.published_at IS NOT NULL;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'training video not found or unpublished' USING ERRCODE = '42704';
  END IF;
  IF v_tenant_id <> v_caller_tnt THEN
    RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501';
  END IF;

  -- Parent: kid must belong to caller's family. Admin: kid must be in tenant.
  SELECT f.tenant_id INTO v_kid_tenant
  FROM public.kids k
  JOIN public.families f ON f.id = k.family_id
  WHERE k.id = p_kid_id
    AND (
      v_caller_role = 'admin'
      OR f.parent_user_id = auth.uid()
    );
  IF v_kid_tenant IS NULL THEN
    RAISE EXCEPTION 'kid not found or not owned by caller' USING ERRCODE = '42501';
  END IF;
  IF v_kid_tenant <> v_caller_tnt THEN
    RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501';
  END IF;

  -- Server-side per-session dedupe: skip if this kid already logged a
  -- view for this video in the last 30 minutes.
  SELECT EXISTS (
    SELECT 1 FROM public.training_video_views v
    WHERE v.training_video_id = p_video_id
      AND v.kid_id = p_kid_id
      AND v.viewed_at > now() - interval '30 minutes'
  ) INTO v_recent;
  IF v_recent THEN
    RETURN false;
  END IF;

  INSERT INTO public.training_video_views (tenant_id, training_video_id, kid_id)
  VALUES (v_tenant_id, p_video_id, p_kid_id);

  UPDATE public.training_videos
     SET view_count = view_count + 1
   WHERE id = p_video_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_training_view(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_training_view(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_training_view(uuid, uuid) IS
  'View logger for training_videos with server-side per-session dedupe (v0.7 task #121 follow-up). Returns true on first view in a 30-minute window, false on subsequent calls — view_count increments AT MOST ONCE per (kid, video) per window regardless of client retries.';
