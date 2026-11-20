-- Approved correction policy: tenant owners and assigned location admins.
-- Independent of capacity configuration; instructors gain no correction power.
BEGIN;
CREATE FUNCTION public.can_correct_booking_instructor(p_tenant_id uuid,p_location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT COALESCE(auth.jwt()->>'app_role' IN ('owner','admin','super_admin'),false)
    AND public.can_manage_booking_location(p_tenant_id,p_location_id);
$$;
REVOKE ALL ON FUNCTION public.can_correct_booking_instructor(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_correct_booking_instructor(uuid,uuid) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.booking_instructor_history FROM authenticated,anon;

CREATE OR REPLACE FUNCTION public.record_booking_attendance(
  p_booking_id uuid,p_action text,p_actual_coach_id uuid DEFAULT NULL,p_reason text DEFAULT NULL
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
  IF p_action='correct' AND NOT public.can_correct_booking_instructor(b.tenant_id,b.location_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF auth.jwt()->>'app_role'='coach' THEN
    SELECT * INTO v_coach FROM public.coaches WHERE user_id=auth.uid() AND tenant_id=b.tenant_id AND is_active;
    IF v_coach.id IS NULL OR (v_coach.capabilities->>'preset' IS DISTINCT FROM 'staff'
      AND b.coach_id IS NOT NULL AND b.coach_id<>v_coach.id AND b.actual_coach_id IS DISTINCT FROM v_coach.id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
  END IF;
  SELECT type_category INTO v_category FROM public.session_types WHERE id=b.session_type_id;
  PERFORM set_config('app.booking_attendance','on',true);
  PERFORM set_config('app.booking_instructor_reason',COALESCE(NULLIF(trim(p_reason),''),'Manual check-in'),true);
  IF p_action='checkin' THEN
    IF b.status='completed' THEN
      IF p_actual_coach_id IS DISTINCT FROM b.actual_coach_id THEN RAISE EXCEPTION 'use_instructor_correction'; END IF;
      PERFORM set_config('app.booking_attendance','off',true);
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
    -- The attribution trigger validates an active instructor at this location
    -- and appends the immutable actor/time/old/new/reason audit entry.
    UPDATE public.bookings SET actual_coach_id=p_actual_coach_id WHERE id=b.id RETURNING * INTO b;
    UPDATE public.sessions SET coach_id=b.actual_coach_id WHERE booking_id=b.id;
  ELSIF p_action='noshow' THEN
    IF b.status='no_show' THEN
      PERFORM set_config('app.booking_attendance','off',true);
      RETURN row_to_json(b);
    END IF;
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

-- Retain one authoritative roster scope and add a server-computed capability
-- used by both portal and mobile. Clients fail closed if the field is absent.
ALTER FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz)
  RENAME TO get_scoped_staff_checkin_roster;
REVOKE ALL ON FUNCTION public.get_scoped_staff_checkin_roster(timestamptz,timestamptz)
  FROM PUBLIC,anon,authenticated,service_role;
-- The existing projection deliberately omits tenant_id; derive the tenant
-- from the authenticated claim rather than adding tenant data to the payload.
CREATE FUNCTION public.get_staff_checkin_roster(p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(entry || jsonb_build_object('can_correct_instructor',
    public.can_correct_booking_instructor((auth.jwt()->>'tenant_id')::uuid,(entry->>'location_id')::uuid))
    ORDER BY entry->>'scheduled_start',entry->>'id'),'[]'::jsonb)
  FROM jsonb_array_elements(public.get_scoped_staff_checkin_roster(p_start,p_end)) entry;
$$;
REVOKE ALL ON FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz) TO authenticated;
COMMIT;
