BEGIN;
CREATE FUNCTION public.guard_camp_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_category text;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT type_category INTO v_category FROM public.session_types WHERE id=NEW.session_type_id;
    IF v_category='group' AND (auth.jwt()->>'role' IS DISTINCT FROM 'service_role'
      OR COALESCE(current_setting('app.camp_fulfillment',true),'')<>'on') THEN
      RAISE EXCEPTION 'camp_or_clinic_event_workflow_required';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.camp_roster_entries WHERE booking_id=OLD.id) THEN
    IF NEW.status='cancelled' AND OLD.status<>'cancelled' THEN RAISE EXCEPTION 'camp_cancellation_policy_required'; END IF;
    IF ROW(NEW.tenant_id,NEW.location_id,NEW.kid_id,NEW.session_type_id,NEW.coach_id,NEW.scheduled_start,NEW.scheduled_end,NEW.cage_number)
      IS DISTINCT FROM ROW(OLD.tenant_id,OLD.location_id,OLD.kid_id,OLD.session_type_id,OLD.coach_id,OLD.scheduled_start,OLD.scheduled_end,OLD.cage_number)
      THEN RAISE EXCEPTION 'camp_schedule_locked'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_camp_booking BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_camp_booking();
REVOKE ALL ON FUNCTION public.guard_camp_booking() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.guard_camp_resource_configuration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||OLD.tenant_id::text,0));
  IF (NOT NEW.is_active OR NEW.purpose NOT IN ('instruction','both')) AND EXISTS (
    SELECT 1 FROM public.camp_event_days d JOIN public.camp_events e ON e.id=d.event_id
    WHERE d.tenant_id=OLD.tenant_id AND d.location_id=OLD.location_id AND d.cage_number=OLD.cage_number
      AND d.ends_at>now() AND e.status<>'archived'
  ) THEN RAISE EXCEPTION 'resource_has_future_reservations'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_camp_resource_configuration BEFORE UPDATE ON public.scheduling_resources
  FOR EACH ROW EXECUTE FUNCTION public.guard_camp_resource_configuration();
REVOKE ALL ON FUNCTION public.guard_camp_resource_configuration() FROM PUBLIC,anon,authenticated;

ALTER FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz) RENAME TO get_bookings_staff_checkin_roster;
REVOKE ALL ON FUNCTION public.get_bookings_staff_checkin_roster(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.get_staff_checkin_roster(p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(entry || CASE WHEN e.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'camp_event_id',e.id,'camp_day_id',d.id,'offering_category',e.offering_category,
    'session_type_name',initcap(e.offering_category)||': '||e.name||' · Day '||d.day_number,
    'cage_number',d.cage_number) END ORDER BY entry->>'scheduled_start',entry->>'id'),'[]'::jsonb)
  FROM jsonb_array_elements(public.get_bookings_staff_checkin_roster(p_start,p_end)) entry
  LEFT JOIN public.camp_roster_entries r ON r.booking_id=(entry->>'id')::uuid
  LEFT JOIN public.camp_event_days d ON d.id=r.day_id
  LEFT JOIN public.camp_events e ON e.id=d.event_id;
$$;
REVOKE ALL ON FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_staff_checkin_roster(timestamptz,timestamptz) TO authenticated;
COMMIT;
