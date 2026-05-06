-- Defense-in-depth hardening for complete_assignment_for_kid:
-- assert that the assignment's kid_id actually belongs to its family_id
-- before mutating kids.points_balance. The insert policy on assignments
-- already enforces this in the normal create path, but a SECURITY DEFINER
-- RPC that mutates a balance shouldn't trust denormalised columns blindly.

CREATE OR REPLACE FUNCTION public.complete_assignment_for_kid(
  p_assignment_id uuid
)
RETURNS TABLE (
  assignment_id   uuid,
  new_balance     integer,
  points_credited integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_jwt_tenant_id  uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_assignment     public.assignments%ROWTYPE;
  v_family         public.families%ROWTYPE;
  v_kid_family_id  uuid;
  v_new_balance    integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  SELECT *
    INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: assignment % not found', p_assignment_id USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_family
    FROM public.families
   WHERE id = v_assignment.family_id;

  IF v_family.parent_user_id <> v_user_id THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: assignment does not belong to caller' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.tenant_id <> v_jwt_tenant_id OR v_family.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  -- Defense-in-depth: re-derive the kid's family_id from public.kids
  -- and confirm it matches the assignment's denormalised family_id.
  -- Guards against malformed assignments rows that bypassed the insert
  -- policy (e.g. via an out-of-band script) before we credit a balance.
  SELECT family_id INTO v_kid_family_id
    FROM public.kids
   WHERE id = v_assignment.kid_id;

  IF v_kid_family_id IS NULL THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: kid % not found', v_assignment.kid_id USING ERRCODE = 'P0002';
  END IF;

  IF v_kid_family_id <> v_assignment.family_id THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: kid/family mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.status <> 'pending' THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: assignment already %', v_assignment.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.assignments
     SET status = 'submitted',
         submitted_at = now()
   WHERE id = v_assignment.id;

  IF v_assignment.point_reward > 0 THEN
    UPDATE public.kids
       SET points_balance = points_balance + v_assignment.point_reward
     WHERE id = v_assignment.kid_id
     RETURNING points_balance INTO v_new_balance;

    BEGIN
      INSERT INTO public.points_ledger (
        tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
      ) VALUES (
        v_jwt_tenant_id, v_assignment.kid_id, v_assignment.point_reward,
        'assignment_completed', 'assignment', v_assignment.id, v_new_balance, v_assignment.title
      );
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'complete_assignment_for_kid: already credited' USING ERRCODE = 'P0001';
    END;
  ELSE
    SELECT points_balance INTO v_new_balance FROM public.kids WHERE id = v_assignment.kid_id;
  END IF;

  assignment_id := v_assignment.id;
  new_balance := v_new_balance;
  points_credited := v_assignment.point_reward;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.complete_assignment_for_kid(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.complete_assignment_for_kid(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.complete_assignment_for_kid(uuid) TO authenticated;
