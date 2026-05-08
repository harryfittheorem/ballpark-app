-- =============================================================================
-- Ballpark — v0.7 assignment edit + cancel RPCs (task #105)
-- =============================================================================
-- The base v0.6 schema (20260506100000_v06_assignments_schema.sql) only
-- grants SELECT + INSERT on public.assignments to authenticated; UPDATE
-- and DELETE intentionally route through SECURITY DEFINER RPCs so we can
-- pin ownership + status + tenant atomically.
--
-- This migration adds two such RPCs:
--   - update_assignment_for_coach(): edit title / description / due_date /
--     drill_video_id on a 'pending' assignment authored by the calling
--     coach. Refused once the parent has marked it submitted.
--   - cancel_assignment_for_coach(): hard-delete a 'pending' assignment
--     authored by the calling coach. Hard delete is safe because no
--     points_ledger row exists for a pending assignment (the
--     complete_assignment_for_kid RPC is what creates the ledger entry,
--     and it requires status='pending' to fire).
--
-- Both refuse once status <> 'pending' so a parent who already marked
-- the drill submitted cannot have it pulled out from under them.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. RPC: update_assignment_for_coach
-- -----------------------------------------------------------------------------
-- Atomically:
--   1. Verifies caller is a coach in the assignment's tenant.
--   2. Verifies caller is the original author (coach_user_id).
--   3. Verifies status is still 'pending'.
--   4. Validates title length (1-120 — same as the table CHECK).
--   5. Validates the optional drill_video_id belongs to the caller's
--      tenant AND was uploaded by the caller (mirrors the defence-in-depth
--      check in portal/app/coach/assignments/new/actions.ts).
--   6. Overwrites all four mutable fields. NULL / empty string clears the
--      column (description, due_date, drill_video_id are all nullable).
--
-- Returns the updated row.
CREATE OR REPLACE FUNCTION public.update_assignment_for_coach(
  p_assignment_id  uuid,
  p_title          text,
  p_description    text,
  p_due_date       date,
  p_drill_video_id uuid
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
  v_clean_title    text;
  v_clean_desc     text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'update_assignment_for_coach: not authenticated' USING ERRCODE = '28000';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  v_app_role      := auth.jwt() ->> 'app_role';

  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'update_assignment_for_coach: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;
  IF v_app_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'update_assignment_for_coach: caller is not a coach' USING ERRCODE = '42501';
  END IF;

  v_clean_title := btrim(coalesce(p_title, ''));
  IF char_length(v_clean_title) < 1 OR char_length(v_clean_title) > 120 THEN
    RAISE EXCEPTION 'update_assignment_for_coach: title must be 1-120 chars' USING ERRCODE = '22023';
  END IF;

  v_clean_desc := NULLIF(btrim(coalesce(p_description, '')), '');

  -- Lock the row so a concurrent complete_assignment_for_kid cannot flip
  -- status under us mid-edit.
  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_assignment_for_coach: assignment % not found', p_assignment_id USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'update_assignment_for_coach: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.coach_user_id <> v_user_id THEN
    RAISE EXCEPTION 'update_assignment_for_coach: only the assigning coach can edit' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.status <> 'pending' THEN
    RAISE EXCEPTION 'update_assignment_for_coach: assignment is %, edits are only allowed while pending', v_assignment.status USING ERRCODE = 'P0001';
  END IF;

  -- Defence-in-depth: drill video, if present, must be in tenant AND
  -- uploaded by the caller. Same check the create flow performs.
  IF p_drill_video_id IS NOT NULL THEN
    PERFORM 1
       FROM public.videos v
      WHERE v.id = p_drill_video_id
        AND v.tenant_id = v_jwt_tenant_id
        AND v.uploaded_by_user_id = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'update_assignment_for_coach: drill video does not belong to caller' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.assignments
     SET title          = v_clean_title,
         description    = v_clean_desc,
         due_date       = p_due_date,
         drill_video_id = p_drill_video_id
   WHERE id = v_assignment.id
   RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;

ALTER FUNCTION public.update_assignment_for_coach(uuid, text, text, date, uuid) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.update_assignment_for_coach(uuid, text, text, date, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_assignment_for_coach(uuid, text, text, date, uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. RPC: cancel_assignment_for_coach
-- -----------------------------------------------------------------------------
-- Atomically deletes a pending assignment owned by the caller. Refuses
-- once the parent has marked it submitted (cancelling a submitted drill
-- would orphan the kid's points credit and the partial unique index on
-- points_ledger.reference_id would block re-creation).
CREATE OR REPLACE FUNCTION public.cancel_assignment_for_coach(
  p_assignment_id uuid
)
RETURNS uuid
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
    RAISE EXCEPTION 'cancel_assignment_for_coach: not authenticated' USING ERRCODE = '28000';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  v_app_role      := auth.jwt() ->> 'app_role';

  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'cancel_assignment_for_coach: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;
  IF v_app_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'cancel_assignment_for_coach: caller is not a coach' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancel_assignment_for_coach: assignment % not found', p_assignment_id USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'cancel_assignment_for_coach: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.coach_user_id <> v_user_id THEN
    RAISE EXCEPTION 'cancel_assignment_for_coach: only the assigning coach can cancel' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.status <> 'pending' THEN
    RAISE EXCEPTION 'cancel_assignment_for_coach: assignment is %, cancellation is only allowed while pending', v_assignment.status USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.assignments WHERE id = v_assignment.id;

  RETURN v_assignment.id;
END;
$$;

ALTER FUNCTION public.cancel_assignment_for_coach(uuid) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.cancel_assignment_for_coach(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_assignment_for_coach(uuid) TO authenticated;
