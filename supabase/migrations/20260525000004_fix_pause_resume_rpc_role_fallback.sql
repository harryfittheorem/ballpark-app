-- =============================================================================
-- Fix pause_membership + resume_membership RPCs: role-claim fallback
--
-- Problem: both RPCs derive app_role via  auth.jwt() ->> 'app_role'.
-- When the Custom Access Token Hook is absent / not yet configured, this
-- returns NULL → the RPCs immediately return 'unauthorized'.
--
-- Fix: if the JWT claim is absent but auth.uid() is present, look up the
-- families table. If the caller's uid matches a parent_user_id they are a
-- parent; otherwise leave the role NULL (still unauthorized for non-parents).
-- Owner/admin paths continue to require an explicit JWT claim.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pause_membership(
  p_membership_id uuid,
  p_pause_end     date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   text;
  v_caller_id     uuid;
  v_caller_tenant text;
  v_mem           record;
  v_today         date := current_date;
  v_overlap_count int;
BEGIN
  v_caller_role   := auth.jwt() ->> 'app_role';
  v_caller_id     := auth.uid();
  v_caller_tenant := auth.jwt() ->> 'tenant_id';

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthorized');
  END IF;

  -- Fallback: if app_role claim is absent, derive role from DB tables.
  -- Owners/admins must always have the explicit JWT claim.
  IF v_caller_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.families WHERE parent_user_id = v_caller_id LIMIT 1) THEN
      v_caller_role := 'parent';
    END IF;
  END IF;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('parent', 'owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT m.id, m.plan_type, m.status, m.tenant_id, m.family_id, f.parent_user_id
    INTO v_mem
    FROM public.memberships m
    JOIN public.families    f ON f.id = m.family_id
   WHERE m.id = p_membership_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_caller_role = 'parent' THEN
    IF v_mem.parent_user_id <> v_caller_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  ELSE
    IF v_caller_tenant IS NULL OR v_mem.tenant_id::text <> v_caller_tenant THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  END IF;

  IF v_mem.plan_type <> 'eft' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eft');
  END IF;
  IF v_mem.status = 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_paused');
  END IF;
  IF v_mem.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_active');
  END IF;
  IF p_pause_end < v_today + 7 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pause_too_short');
  END IF;
  IF p_pause_end > v_today + 90 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pause_too_long');
  END IF;

  SELECT COUNT(*)
    INTO v_overlap_count
    FROM public.memberships
   WHERE family_id = v_mem.family_id
     AND id       <> p_membership_id
     AND status    = 'paused'
     AND pause_end >= v_today;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'family_already_paused');
  END IF;

  UPDATE public.memberships
     SET status      = 'paused',
         pause_start = v_today,
         pause_end   = p_pause_end,
         paused_at   = now(),
         updated_at  = now()
   WHERE id = p_membership_id;

  RETURN jsonb_build_object('ok', true, 'pause_start', v_today, 'pause_end', p_pause_end);
END;
$$;

REVOKE ALL ON FUNCTION public.pause_membership(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pause_membership(uuid, date) TO authenticated;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resume_membership(
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   text;
  v_caller_id     uuid;
  v_caller_tenant text;
  v_mem           record;
BEGIN
  v_caller_role   := auth.jwt() ->> 'app_role';
  v_caller_id     := auth.uid();
  v_caller_tenant := auth.jwt() ->> 'tenant_id';

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthorized');
  END IF;

  IF v_caller_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.families WHERE parent_user_id = v_caller_id LIMIT 1) THEN
      v_caller_role := 'parent';
    END IF;
  END IF;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('parent', 'owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT m.id, m.status, m.tenant_id, f.parent_user_id
    INTO v_mem
    FROM public.memberships m
    JOIN public.families    f ON f.id = m.family_id
   WHERE m.id = p_membership_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_caller_role = 'parent' THEN
    IF v_mem.parent_user_id <> v_caller_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  ELSE
    IF v_caller_tenant IS NULL OR v_mem.tenant_id::text <> v_caller_tenant THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  END IF;

  IF v_mem.status <> 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_paused');
  END IF;

  UPDATE public.memberships
     SET status      = 'active',
         pause_start = NULL,
         pause_end   = NULL,
         paused_at   = NULL,
         updated_at  = now()
   WHERE id     = p_membership_id
     AND status = 'paused';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.resume_membership(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resume_membership(uuid) TO authenticated;
