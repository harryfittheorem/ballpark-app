-- =============================================================================
-- Widen assignments and coach_messages INSERT policies for staff roles
-- =============================================================================
--
-- Previously both insert policies required app_role = 'coach', which blocks
-- admin / owner / super_admin callers even after the families/kids RLS fixes
-- in 20260614000000 let them read the relevant rows. These callers have no
-- coaches row by design (the client-side createAssignment / sendCoachMessage
-- now falls back to JWT tenant_id for the tenantId field), but the RLS
-- WITH CHECK still rejected them at the database layer.
--
-- Strategy:
--   Replace the single coach-only policy with a widened version that accepts
--   app_role IN ('coach', 'admin', 'owner', 'super_admin'). All FK anti-
--   smuggling EXISTS clauses are preserved verbatim — they pin kid+family to
--   the JWT tenant_id and are evaluated under the caller's RLS context, which
--   now allows admin/owner/super_admin to see those rows (via
--   families_staff_role_tenant_select + kids_select_admin/_owner_select /
--   _select_super_admin). Nothing else on the table changes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. assignments — widen insert to staff roles
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS assignments_insert_own_coach ON public.assignments;

CREATE POLICY assignments_insert_own_coach ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND coach_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') IN ('coach', 'admin', 'owner', 'super_admin')
    AND EXISTS (
      SELECT 1
        FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
       WHERE k.id = assignments.kid_id
         AND f.id = assignments.family_id
         AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND (
      assignments.drill_video_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.videos v
         WHERE v.id = assignments.drill_video_id
           AND v.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      )
    )
  );

COMMENT ON POLICY assignments_insert_own_coach ON public.assignments IS
$c$Cross-tenant FK smuggling defense (same pattern as coach_messages_insert_own_coach).
The kid+family sub-select verifies the kid belongs to that family AND pins
f.tenant_id to the JWT tenant. The optional drill_video_id sub-select pins
the video tenant likewise. Do not simplify either EXISTS clause.
Widened from app_role='coach' to include admin/owner/super_admin (20260614000001).$c$;


-- ---------------------------------------------------------------------------
-- 2. coach_messages — widen insert to staff roles (coach→family direction)
-- ---------------------------------------------------------------------------
-- The parent_to_coach direction (coach_messages_insert_own_parent) is
-- intentionally left untouched — parents can only insert rows they themselves
-- compose and that is unrelated to staff roles.

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
      OR EXISTS (
        SELECT 1 FROM public.videos v
         WHERE v.id = coach_messages.video_id
           AND v.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      )
    )
  );

COMMENT ON POLICY coach_messages_insert_own_coach ON public.coach_messages IS
$c$Cross-tenant FK smuggling defense (same pattern as 20260505081000).
The kid+family sub-select does TWO things:
  (a) Verifies recipient_kid_id+recipient_family_id form a real pair.
  (b) Pins f.tenant_id to the JWT tenant to prevent cross-tenant FK smuggling.
The video EXISTS clause does the same tenant pin for the optional video_id.
Do NOT simplify either EXISTS clause.
Widened from app_role='coach' to include admin/owner/super_admin (20260614000001).$c$;


-- =============================================================================
-- VALIDATION
--
-- 1. Admin can INSERT an assignment (kid + family must be in same tenant):
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<admin_uid>","app_role":"admin","tenant_id":"<tid>"}';
--    INSERT INTO public.assignments
--      (tenant_id, coach_user_id, kid_id, family_id, title, point_reward)
--    VALUES ('<tid>', '<admin_uid>', '<kid_uuid>', '<family_uuid>', 'Test', 25)
--    RETURNING id;   -- must succeed
--
-- 2. Coach insert behaviour unchanged:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<coach_uid>","app_role":"coach","tenant_id":"<tid>"}';
--    INSERT INTO public.assignments (...) VALUES (...) RETURNING id;
--    -- must still succeed
--
-- 3. Parent insert rejected:
--    SET LOCAL "request.jwt.claims" TO
--      '{"sub":"<parent_uid>","app_role":"parent","tenant_id":"<tid>"}';
--    INSERT INTO public.assignments (...) VALUES (...);
--    -- must fail with RLS violation (not a new regression — was always blocked)
-- =============================================================================
