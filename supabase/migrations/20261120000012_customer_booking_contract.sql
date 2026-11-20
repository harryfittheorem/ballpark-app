BEGIN;

-- Consumer and public booking now commit the reservation, credit deduction
-- and retry receipt together. The coach is an internal scheduled resource,
-- not a customer-selected instructor.
CREATE FUNCTION public.create_customer_booking(
  p_kid_id uuid,p_location_id uuid,p_session_type_id uuid,p_scheduled_start timestamptz,
  p_request_id uuid,p_coach_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid;
  v_type public.session_types%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_request public.booking_creation_requests%ROWTYPE;
  v_payload jsonb := jsonb_build_array('customer',p_kid_id,p_location_id,p_session_type_id,p_scheduled_start);
  v_coach uuid;
  v_remaining integer;
  v_end timestamptz;
  v_local timestamp;
BEGIN
  SELECT f.tenant_id INTO v_tenant FROM public.kids k JOIN public.families f ON f.id=k.family_id
    WHERE k.id=p_kid_id AND f.parent_user_id=auth.uid();
  IF v_tenant IS NULL OR auth.uid() IS NULL OR v_tenant IS DISTINCT FROM (auth.jwt()->>'tenant_id')::uuid THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_request FROM public.booking_creation_requests
    WHERE tenant_id=v_tenant AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF v_request.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
    SELECT * INTO v_booking FROM public.bookings WHERE id=v_request.booking_id;
    RETURN jsonb_build_object('booking',to_jsonb(v_booking),'sessions_remaining',public.check_session_credits(p_kid_id,v_tenant));
  END IF;
  SELECT * INTO v_type FROM public.session_types WHERE id=p_session_type_id AND tenant_id=v_tenant AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_type_not_found'; END IF;
  IF p_scheduled_start IS NULL OR p_scheduled_start<=now() OR NOT isfinite(p_scheduled_start) THEN RAISE EXCEPTION 'invalid_booking_dates'; END IF;
  v_end := p_scheduled_start+make_interval(mins=>v_type.duration_minutes);
  SELECT p_scheduled_start AT TIME ZONE l.timezone INTO v_local FROM public.locations l
    WHERE l.id=p_location_id AND l.tenant_id=v_tenant;
  IF v_local IS NULL THEN RAISE EXCEPTION 'location_not_found'; END IF;
  -- Use existing availability for the internal resource; no named coach is
  -- required from the caller. Approved pooled capacity is enforced in trigger.
  SELECT c.id INTO v_coach FROM public.coaches c JOIN public.coach_locations cl ON cl.coach_id=c.id
    WHERE c.tenant_id=v_tenant AND c.is_active AND cl.location_id=p_location_id
      AND EXISTS (SELECT 1 FROM public.coach_availability a WHERE a.coach_id=c.id AND a.tenant_id=v_tenant
        AND a.location_id=p_location_id
        AND a.day_of_week=extract(dow FROM v_local)::int AND a.start_time<=v_local::time
        AND a.end_time>=(v_local+make_interval(mins=>v_type.duration_minutes))::time
        AND (v_local+make_interval(mins=>v_type.duration_minutes))::date=v_local::date
        AND (a.effective_from IS NULL OR a.effective_from<=v_local::date)
        AND (a.effective_until IS NULL OR a.effective_until>=v_local::date))
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.coach_id=c.id AND b.tenant_id=v_tenant
        AND b.status NOT IN ('cancelled','no_show') AND b.scheduled_start<v_end AND b.scheduled_end>p_scheduled_start
        AND ROW(b.session_type_id,b.scheduled_start,b.scheduled_end) IS DISTINCT FROM ROW(p_session_type_id,p_scheduled_start,v_end))
      AND (SELECT count(*) FROM public.bookings b WHERE b.coach_id=c.id AND b.tenant_id=v_tenant
        AND b.status NOT IN ('cancelled','no_show') AND b.scheduled_start<v_end AND b.scheduled_end>p_scheduled_start)<v_type.capacity
    ORDER BY (c.id=p_coach_id) DESC NULLS LAST,c.id LIMIT 1;
  IF v_coach IS NULL THEN RAISE EXCEPTION 'slot_not_available'; END IF;
  INSERT INTO public.bookings(tenant_id,location_id,kid_id,coach_id,session_type_id,scheduled_start,scheduled_end,status)
    VALUES(v_tenant,p_location_id,p_kid_id,v_coach,p_session_type_id,p_scheduled_start,v_end,'confirmed') RETURNING * INTO v_booking;
  v_remaining := public.deduct_session_credit(v_booking.id);
  INSERT INTO public.booking_creation_requests VALUES(v_tenant,auth.uid(),p_request_id,v_payload,v_booking.id);
  RETURN jsonb_build_object('booking',to_jsonb(v_booking),'sessions_remaining',v_remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_booking(uuid,uuid,uuid,timestamptz,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_customer_booking(uuid,uuid,uuid,timestamptz,uuid,uuid) TO authenticated;

DROP FUNCTION public.create_public_booking(text,uuid,uuid,uuid,uuid,timestamptz);
CREATE FUNCTION public.create_public_booking(
  p_tenant_slug text,p_coach_id uuid,p_location_id uuid,p_session_type_id uuid,p_kid_id uuid,p_scheduled_start timestamptz,
  p_request_id uuid DEFAULT NULL
) RETURNS TABLE(booking_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; v_key uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug=p_tenant_slug AND id=(auth.jwt()->>'tenant_id')::uuid) THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;
  -- Compatibility receipt for older clients; new clients send a fresh request
  -- ID per intended purchase, reusing it only on retry.
  v_key := COALESCE(p_request_id,md5(jsonb_build_array(auth.uid(),p_kid_id,p_location_id,p_session_type_id,p_scheduled_start)::text)::uuid);
  v_result := public.create_customer_booking(p_kid_id,p_location_id,p_session_type_id,p_scheduled_start,v_key,p_coach_id);
  RETURN QUERY SELECT (v_result->'booking'->>'id')::uuid;
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_booking(text,uuid,uuid,uuid,uuid,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text,uuid,uuid,uuid,uuid,timestamptz,uuid) TO authenticated;

-- Keep the old mobile INSERT grant during the app-version cutover. The common
-- reservation/attribution triggers protect those writes too. New clients use
-- only the transactional RPC. Do not silently break already-installed apps.
-- Hard deletes have no supported UI and would discard audit/credit provenance.
REVOKE DELETE ON public.bookings FROM authenticated;
COMMIT;
