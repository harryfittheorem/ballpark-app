-- =============================================================================
-- Fix coach_messages_insert_own_coach RLS recursion (text replies)
-- =============================================================================
--
-- Migration 20260614000001 widened coach_messages_insert_own_coach to accept
-- admin/owner/super_admin roles but accidentally reintroduced the raw EXISTS
-- subquery against public.videos that 20260507233000 specifically fixed.
--
-- The cycle:
--   coach_messages_insert_own_coach (WITH CHECK) →
--     EXISTS (SELECT 1 FROM public.videos v …)  →
--     videos SELECT RLS (videos_select_recipient_parent USING) →
--     EXISTS (SELECT 1 FROM coach_messages cm …) →
--     re-enters coach_messages policies → 42P17
--
-- Fix: replace the raw EXISTS on videos with public._video_in_tenant()
-- (SECURITY DEFINER helper from 20260507233000) which bypasses videos SELECT
-- RLS and breaks the cycle. The staff-role widening from 20260614000001 is
-- fully preserved.
-- =============================================================================

DROP POLICY IF EXISTS coach_messages_insert_own_coach ON public.coach_messages;

CREATE POLICY coach_messages_insert_own_coach ON public.coach_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND sender_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') IN ('coach', 'admin', 'owner', 'super_admin')
    AND EXISTS (
      SELECT 1
        FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
       WHERE k.id = coach_messages.recipient_kid_id
         AND f.id = coach_messages.recipient_family_id
         AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND (
      coach_messages.video_id IS NULL
      OR public._video_in_tenant(
           coach_messages.video_id,
           (auth.jwt() ->> 'tenant_id')::uuid
         )
    )
  );

COMMENT ON POLICY coach_messages_insert_own_coach ON public.coach_messages IS
$c$Cross-tenant FK smuggling defense (same pattern as 20260505081000).
The kid+family sub-select verifies recipient_kid_id+recipient_family_id form
a real pair and pins f.tenant_id to the JWT tenant.
The video check uses public._video_in_tenant() (SECURITY DEFINER, from
20260507233000) to break the videos<->coach_messages RLS cycle (42P17).
Do NOT replace _video_in_tenant() with a raw EXISTS on public.videos — that
reintroduces the cycle (see 20260614000002).
Widened from app_role='coach' to include admin/owner/super_admin (20260614000001).$c$;
