-- =============================================================================
-- Ballpark — v0.6 review_assignment: tighten to owning coach
-- =============================================================================
-- The original review_assignment (20260506100000_v06_assignments_schema.sql)
-- allowed any coach in the tenant to review any submitted drill, mirroring
-- the v0.5 booking-completion pattern. The v0.6 spec
-- (.local/tasks/v06-work-assignments.md, Step 1) explicitly requires the
-- review RPC to be restricted to the owning coach (the coach who created
-- the assignment).
--
-- Note: the assignments table stores the creating coach as `coach_user_id`
-- (auth.users FK), so the ownership check compares directly against
-- auth.uid() — there is no separate `coaches.id` linkage on this table.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.review_assignment(
  p_assignment_id uuid,
  p_rating        int,
  p_feedback      text
)
RETURNS public.assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_jwt_tenant_id  uuid;
  v_app_role       text;
  v_assignment     public.assignments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'review_assignment: not authenticated' USING ERRCODE = '28000';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  v_app_role      := auth.jwt() ->> 'app_role';

  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'review_assignment: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;
  IF v_app_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'review_assignment: caller is not a coach' USING ERRCODE = '42501';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'review_assignment: rating must be 1-5' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_assignment: assignment % not found', p_assignment_id USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'review_assignment: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  -- Owning coach only (per v0.6 task requirement). The assignments table
  -- stores the assigning coach's auth.users id as coach_user_id, so we
  -- compare directly against auth.uid().
  IF v_assignment.coach_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'review_assignment: only the assigning coach can review this drill' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.status <> 'submitted' THEN
    RAISE EXCEPTION 'review_assignment: assignment is %, must be submitted', v_assignment.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.assignments
     SET status      = 'reviewed',
         reviewed_at = now(),
         rating      = p_rating,
         feedback    = NULLIF(btrim(p_feedback), '')
   WHERE id = v_assignment.id
   RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;
