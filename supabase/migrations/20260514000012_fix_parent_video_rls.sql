-- =============================================================================
-- Fix coach_messages_insert_own_parent: avoid the same 42P17 RLS recursion
-- that was fixed for coaches in migration 20260507233000.
--
-- Cycle for parent video sends:
--   coach_messages_insert_own_parent (WITH CHECK) →
--     EXISTS (SELECT 1 FROM videos v …)  →
--     videos SELECT RLS (videos_select_recipient_parent USING) →
--     EXISTS (SELECT 1 FROM coach_messages cm …) →
--     re-enters coach_messages policies → 42P17
--
-- Fix: introduce _video_is_parent_upload, a SECURITY DEFINER function that
-- bypasses videos SELECT RLS, and use it in the policy instead of the raw
-- EXISTS subquery.  Same pattern as _video_in_tenant from 20260507233000.
--
-- Text-only parent messages (video_id IS NULL) were NOT affected by this
-- cycle because the OR short-circuits. Only parent→coach video sends hit it.
-- =============================================================================

-- 1. Helper -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._video_is_parent_upload(
  p_video_id uuid,
  p_tenant_id uuid,
  p_user_id   uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.videos v
    WHERE v.id                  = p_video_id
      AND v.tenant_id           = p_tenant_id
      AND v.uploaded_by_user_id = p_user_id
      AND v.purpose             = 'parent_to_coach'
  );
$$;

REVOKE ALL ON FUNCTION public._video_is_parent_upload(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._video_is_parent_upload(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public._video_is_parent_upload(uuid, uuid, uuid) IS
  'RLS-bypass helper: returns true iff the video was uploaded by the given user'
  ' for parent_to_coach purpose in the given tenant. Used by'
  ' coach_messages_insert_own_parent to avoid the videos<->coach_messages RLS'
  ' cycle that causes 42P17 (same pattern as _video_in_tenant in 20260507233000).';


-- 2. Rewrite the parent INSERT policy to use the helper --------------------

DROP POLICY IF EXISTS coach_messages_insert_own_parent ON public.coach_messages;

CREATE POLICY coach_messages_insert_own_parent ON public.coach_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id        = (auth.jwt() ->> 'tenant_id')::uuid
    AND sender_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'parent'
    AND EXISTS (
      SELECT 1
        FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
       WHERE k.id              = coach_messages.recipient_kid_id
         AND f.id              = coach_messages.recipient_family_id
         AND f.parent_user_id  = auth.uid()
         AND f.tenant_id       = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND coach_messages.recipient_coach_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.coaches c
       WHERE c.user_id   = coach_messages.recipient_coach_user_id
         AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND (
      coach_messages.video_id IS NULL
      OR public._video_is_parent_upload(
           coach_messages.video_id,
           (auth.jwt() ->> 'tenant_id')::uuid,
           auth.uid()
         )
    )
  );

COMMENT ON POLICY coach_messages_insert_own_parent ON public.coach_messages IS
  'v0.7 task #120 — parent can INSERT a row addressed to one of their own kids.'
  ' If a video is attached it must be the parent''s own parent_to_coach upload'
  ' in the same tenant. Uses _video_is_parent_upload (SECURITY DEFINER) to'
  ' break the videos<->coach_messages RLS cycle (fixed in 20260514000012;'
  ' same pattern as coaches in 20260507233000).';
