-- Break the RLS recursion between (coach_messages | assignments) and videos.
--
-- Symptom: when a coach taps Send on the Send-Video screen the INSERT into
-- public.coach_messages fails with
--     ERROR: 42P17 infinite recursion detected in policy for relation "coach_messages"
--
-- The cycle (same shape exists for assignments):
--   coach_messages_insert_own_coach (WITH CHECK) does
--       EXISTS (SELECT 1 FROM videos v WHERE v.id = coach_messages.video_id ...)
--   videos_select_recipient_parent (USING) does
--       EXISTS (SELECT 1 FROM coach_messages cm JOIN families f ...)
--   so videos.SELECT RLS pulls coach_messages.SELECT RLS, which pulls in
--   policies that re-enter videos. Postgres' RLS planner flags this
--   statically and refuses to run the INSERT.
--
-- The same shape exists between public.assignments (INSERT) and
-- public.videos (SELECT via videos_select_assignment_parent), since the
-- v0.6 assignments policy also does an EXISTS on videos in its WITH CHECK.
--
-- Fix: introduce a SECURITY DEFINER helper that confirms a video belongs
-- to a tenant *without* applying videos' SELECT RLS. The helper is the
-- minimum-privilege version of the original EXISTS subquery — it accepts
-- only the two columns we already pin (video_id and tenant_id), so a
-- caller can't smuggle in some other tenant's id (the WHERE clause forces
-- the tenant pin against the JWT-provided value the policy already
-- evaluates).
--
-- The function is STABLE and SET search_path = public,pg_temp so a
-- malicious schema can't shadow `videos`. EXECUTE is granted only to
-- `authenticated`; we revoke from PUBLIC explicitly.

-- 1. Helper -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._video_in_tenant(
  p_video_id uuid,
  p_tenant_id uuid
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
    WHERE v.id = p_video_id
      AND v.tenant_id = p_tenant_id
  );
$$;

REVOKE ALL ON FUNCTION public._video_in_tenant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._video_in_tenant(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public._video_in_tenant(uuid, uuid) IS
  'RLS-bypass helper: returns true iff the given video row exists in the given tenant. Used by INSERT policies on coach_messages and assignments to break the videos<->coach_messages / videos<->assignments RLS cycle that otherwise causes 42P17 (see migration 20260507233000).';

-- 2. coach_messages_insert_own_coach ---------------------------------------

DROP POLICY IF EXISTS coach_messages_insert_own_coach ON public.coach_messages;

CREATE POLICY coach_messages_insert_own_coach ON public.coach_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
    AND sender_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND EXISTS (
      SELECT 1
      FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE k.id = coach_messages.recipient_kid_id
        AND f.id = coach_messages.recipient_family_id
        AND f.tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
    )
    AND (
      coach_messages.video_id IS NULL
      OR public._video_in_tenant(
        coach_messages.video_id,
        ((auth.jwt() ->> 'tenant_id')::uuid)
      )
    )
  );

COMMENT ON POLICY coach_messages_insert_own_coach ON public.coach_messages IS
  'Coach can insert a message they are the sender of, into a kid+family pair in their own tenant, optionally referencing a video in the same tenant. The video tenancy check goes through public._video_in_tenant (SECURITY DEFINER) to avoid the videos<->coach_messages RLS cycle.';

-- 3. assignments_insert_own_coach ------------------------------------------

DROP POLICY IF EXISTS assignments_insert_own_coach ON public.assignments;

CREATE POLICY assignments_insert_own_coach ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
    AND coach_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND EXISTS (
      SELECT 1
      FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE k.id = assignments.kid_id
        AND f.id = assignments.family_id
        AND f.tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
    )
    AND (
      assignments.drill_video_id IS NULL
      OR public._video_in_tenant(
        assignments.drill_video_id,
        ((auth.jwt() ->> 'tenant_id')::uuid)
      )
    )
  );

COMMENT ON POLICY assignments_insert_own_coach ON public.assignments IS
  'Coach can insert an assignment for a kid+family pair in their own tenant, optionally referencing a drill video in the same tenant. The video tenancy check goes through public._video_in_tenant (SECURITY DEFINER) to avoid the videos<->assignments RLS cycle.';
