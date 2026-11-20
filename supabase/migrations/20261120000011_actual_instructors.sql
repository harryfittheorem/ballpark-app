BEGIN;

CREATE TABLE public.booking_instructor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  previous_coach_id uuid,
  actual_coach_id uuid,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_instructor_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY instructor_history_staff_read ON public.booking_instructor_history FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id,location_id));
GRANT SELECT ON public.booking_instructor_history TO authenticated;
GRANT ALL ON public.booking_instructor_history TO service_role;

-- Guard direct-table writes too: RLS alone previously let a parent change the
-- status or resource of their own booking. Attendance must use the RPC below.
CREATE FUNCTION public.guard_booking_mutations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_attendance boolean := COALESCE(current_setting('app.booking_attendance',true),'')='on';
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.actual_coach_id IS NOT NULL OR NEW.attended_at IS NOT NULL OR (NEW.status='completed' AND auth.jwt()->>'role' IS DISTINCT FROM 'service_role') THEN
      RAISE EXCEPTION 'attendance_rpc_required';
    END IF;
    RETURN NEW;
  END IF;
  IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND COALESCE(auth.jwt()->>'app_role','') IN ('owner','admin','super_admin','coach')
      AND NOT COALESCE(public.can_manage_booking_location(OLD.tenant_id,OLD.location_id),false)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    IF ROW(NEW.tenant_id,NEW.location_id,NEW.kid_id,NEW.coach_id,NEW.session_type_id,NEW.scheduled_start,NEW.scheduled_end,NEW.cage_number)
      IS DISTINCT FROM ROW(OLD.tenant_id,OLD.location_id,OLD.kid_id,OLD.coach_id,OLD.session_type_id,OLD.scheduled_start,OLD.scheduled_end,OLD.cage_number)
      AND (NOT COALESCE(public.can_manage_booking_location(OLD.tenant_id,OLD.location_id),false)
        OR NOT COALESCE(public.can_manage_booking_location(NEW.tenant_id,NEW.location_id),false)
        OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin'))
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'cancelled' OR NEW.attended_at IS DISTINCT FROM OLD.attended_at)
      AND NOT v_attendance THEN RAISE EXCEPTION 'attendance_rpc_required'; END IF;
  END IF;
  IF NEW.actual_coach_id IS DISTINCT FROM OLD.actual_coach_id THEN
    IF NOT v_attendance OR auth.uid() IS NULL THEN RAISE EXCEPTION 'instructor_rpc_required'; END IF;
    IF NEW.actual_coach_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.coaches c JOIN public.coach_locations cl ON cl.coach_id=c.id
      WHERE c.id=NEW.actual_coach_id AND c.tenant_id=NEW.tenant_id AND c.is_active AND cl.location_id=NEW.location_id
    ) THEN RAISE EXCEPTION 'instructor_not_eligible_at_location'; END IF;
    INSERT INTO public.booking_instructor_history(booking_id,tenant_id,location_id,previous_coach_id,actual_coach_id,actor_id,reason)
    VALUES(NEW.id,NEW.tenant_id,NEW.location_id,OLD.actual_coach_id,NEW.actual_coach_id,auth.uid(),
      COALESCE(NULLIF(current_setting('app.booking_instructor_reason',true),''),'Manual check-in'));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_booking_mutations BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_mutations();
REVOKE ALL ON FUNCTION public.guard_booking_mutations() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.record_booking_attendance(
  p_booking_id uuid, p_action text, p_actual_coach_id uuid DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  b public.bookings%ROWTYPE;
  v_category text;
  v_coach public.coaches%ROWTYPE;
  v_delta integer;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(public.can_manage_booking_location(b.tenant_id,b.location_id),false) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF auth.jwt()->>'app_role'='coach' THEN
    SELECT * INTO v_coach FROM public.coaches WHERE user_id=auth.uid() AND tenant_id=b.tenant_id AND is_active;
    IF v_coach.id IS NULL OR (v_coach.capabilities->>'preset' IS DISTINCT FROM 'staff'
      AND b.coach_id IS NOT NULL AND b.coach_id<>v_coach.id AND b.actual_coach_id IS DISTINCT FROM v_coach.id)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;
  SELECT type_category INTO v_category FROM public.session_types WHERE id=b.session_type_id;
  PERFORM set_config('app.booking_attendance','on',true);
  PERFORM set_config('app.booking_instructor_reason',COALESCE(NULLIF(trim(p_reason),''),'Manual check-in'),true);
  IF p_action='checkin' THEN
    IF b.status='completed' THEN
      IF p_actual_coach_id IS DISTINCT FROM b.actual_coach_id THEN RAISE EXCEPTION 'use_instructor_correction'; END IF;
      RETURN row_to_json(b);
    END IF;
    IF b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
    IF v_category<>'cage' AND p_actual_coach_id IS NULL THEN RAISE EXCEPTION 'actual_instructor_required'; END IF;
    UPDATE public.bookings SET status='completed',attended_at=now(),actual_coach_id=p_actual_coach_id
      WHERE id=b.id RETURNING * INTO b;
    IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE booking_id=b.id) THEN
      INSERT INTO public.sessions(tenant_id,kid_id,coach_id,booking_id,capture_source,started_at,ended_at)
      VALUES(b.tenant_id,b.kid_id,b.actual_coach_id,b.id,'none',b.scheduled_start,b.scheduled_end);
    END IF;
  ELSIF p_action='correct' THEN
    IF b.status<>'completed' OR p_actual_coach_id IS NULL OR NULLIF(trim(p_reason),'') IS NULL THEN
      RAISE EXCEPTION 'completed_booking_instructor_and_reason_required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.scheduling_location_rules WHERE tenant_id=b.tenant_id AND location_id=b.location_id
      AND approved_at IS NOT NULL AND instructor_corrections_approved
      AND (auth.jwt()->>'app_role')=ANY(correction_roles)) THEN
      RAISE EXCEPTION 'instructor_correction_policy_required';
    END IF;
    UPDATE public.bookings SET actual_coach_id=p_actual_coach_id WHERE id=b.id RETURNING * INTO b;
    UPDATE public.sessions SET coach_id=b.actual_coach_id WHERE booking_id=b.id;
  ELSIF p_action='noshow' THEN
    IF b.status='no_show' THEN RETURN row_to_json(b); END IF;
    IF b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
    UPDATE public.bookings SET status='no_show',attended_at=NULL WHERE id=b.id RETURNING * INTO b;
  ELSIF p_action='undo' THEN
    IF b.status<>'completed' THEN RAISE EXCEPTION 'NOT_CHECKED_IN'; END IF;
    IF b.attended_at IS NULL OR b.attended_at<now()-interval '5 minutes' THEN RAISE EXCEPTION 'UNDO_WINDOW_EXPIRED'; END IF;
    PERFORM set_config('app.booking_instructor_reason','Check-in undone',true);
    UPDATE public.bookings SET status='confirmed',attended_at=NULL,actual_coach_id=NULL WHERE id=b.id RETURNING * INTO b;
    DELETE FROM public.sessions WHERE booking_id=b.id;
    SELECT sum(delta) INTO v_delta FROM public.points_ledger WHERE kid_id=b.kid_id AND reference_type='booking'
      AND reference_id=b.id AND reason='session_attended';
    IF v_delta IS NOT NULL THEN
      DELETE FROM public.points_ledger WHERE kid_id=b.kid_id AND reference_type='booking' AND reference_id=b.id AND reason='session_attended';
      UPDATE public.kids SET points_balance=GREATEST(0,points_balance-v_delta) WHERE id=b.kid_id;
    END IF;
  ELSE RAISE EXCEPTION 'invalid_attendance_action';
  END IF;
  PERFORM set_config('app.booking_attendance','off',true);
  RETURN row_to_json(b);
END;
$$;
REVOKE ALL ON FUNCTION public.record_booking_attendance(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_booking_attendance(uuid,text,uuid,text) TO authenticated;

-- Retain the established public signatures without retaining the service-role
-- bypass. Old lesson callers receive an explicit instructor-required error.
CREATE OR REPLACE FUNCTION public.check_in_booking(p_booking_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.record_booking_attendance(p_booking_id,'checkin');
$$;
CREATE OR REPLACE FUNCTION public.mark_no_show(p_booking_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.record_booking_attendance(p_booking_id,'noshow');
$$;
CREATE OR REPLACE FUNCTION public.undo_check_in(p_booking_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.record_booking_attendance(p_booking_id,'undo');
$$;
REVOKE ALL ON FUNCTION public.check_in_booking(uuid), public.mark_no_show(uuid), public.undo_check_in(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid), public.mark_no_show(uuid), public.undo_check_in(uuid) TO authenticated;

CREATE VIEW public.booking_instructor_attribution WITH (security_invoker=true) AS
  SELECT id AS booking_id,tenant_id,location_id,kid_id,session_type_id,scheduled_start,scheduled_end,
    coach_id AS scheduled_coach_id,actual_coach_id,status,attended_at
  FROM public.bookings;
GRANT SELECT ON public.booking_instructor_attribution TO authenticated;

-- Assigned instructors may see unassigned facility bookings to check in the
-- actual lesson. No tenant-wide staff-preset bypass for this new path.
CREATE POLICY bookings_select_unassigned_instructor ON public.bookings FOR SELECT TO authenticated
  USING (coach_id IS NULL AND public.can_manage_booking_location(tenant_id,location_id));

CREATE FUNCTION public.get_staff_checkin_roster(p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin','coach')
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR p_end-p_start>interval '2 days'
    THEN RAISE EXCEPTION 'invalid_roster_range'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(row_to_json(r) ORDER BY r.scheduled_start) FROM (
    SELECT b.id,b.location_id,b.kid_id,b.coach_id,b.actual_coach_id,b.scheduled_start,b.scheduled_end,b.cage_number,b.status,b.attended_at,
      k.first_name AS kid_first_name,k.last_name AS kid_last_name,
      c.first_name AS coach_first_name,c.last_name AS coach_last_name,
      ac.first_name AS actual_coach_first_name,ac.last_name AS actual_coach_last_name,
      st.name AS session_type_name,st.type_category,
      (SELECT m.status FROM public.memberships m WHERE m.kid_id=b.kid_id
        ORDER BY (m.status IN ('active','paused')) DESC,m.started_at DESC LIMIT 1) AS membership_status,
      (SELECT count(*) FROM public.assignments a WHERE a.kid_id=b.kid_id AND a.status='pending') AS pending_assignment_count
    FROM public.bookings b
    LEFT JOIN public.kids k ON k.id=b.kid_id
    LEFT JOIN public.coaches c ON c.id=b.coach_id
    LEFT JOIN public.coaches ac ON ac.id=b.actual_coach_id
    LEFT JOIN public.session_types st ON st.id=b.session_type_id
    WHERE b.scheduled_start>=p_start AND b.scheduled_start<p_end AND b.status<>'cancelled'
      AND public.can_manage_booking_location(b.tenant_id,b.location_id)
      AND (auth.jwt()->>'app_role'<>'coach' OR b.coach_id IS NULL OR EXISTS (
        SELECT 1 FROM public.coaches me WHERE me.user_id=auth.uid() AND me.tenant_id=b.tenant_id AND me.is_active
          AND (me.id=b.coach_id OR me.id=b.actual_coach_id OR me.capabilities->>'preset'='staff')))
  ) r),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz) TO authenticated;

CREATE FUNCTION public.get_checkin_instructors(p_location_id uuid)
RETURNS TABLE(id uuid,first_name text,last_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT c.id,c.first_name,c.last_name FROM public.coaches c
    JOIN public.coach_locations cl ON cl.coach_id=c.id
    WHERE cl.location_id=p_location_id AND c.is_active
      AND public.can_manage_booking_location(c.tenant_id,p_location_id)
    ORDER BY c.first_name,c.last_name;
$$;
REVOKE ALL ON FUNCTION public.get_checkin_instructors(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_checkin_instructors(uuid) TO authenticated;

COMMIT;
