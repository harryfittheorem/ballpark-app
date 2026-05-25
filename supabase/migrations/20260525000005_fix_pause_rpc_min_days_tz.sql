-- =============================================================================
-- Lower pause_membership minimum days from 7 to 6 to absorb timezone skew.
--
-- Problem: clients in UTC-N timezones send "7 days from local today" which
-- arrives at the UTC server as 6 days ahead. The RPC check
--   IF p_pause_end < v_today + 7
-- then rejects it as "pause_too_short" even though the user picked 1 week.
--
-- Fix: change the boundary to v_today + 6 (i.e. accept pause_end that is at
-- least 6 days after the server's UTC current_date). The 1-day buffer covers
-- UTC-11 … UTC+0. Clients are never in a positive UTC offset large enough to
-- push the date backwards by a day.
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

  -- 6 days (not 7) to absorb up to 1 day of UTC-offset skew from the client.
  IF p_pause_end < v_today + 6 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pause_too_short');
  END IF;
  IF p_pause_end > v_today + 91 THEN
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
