-- Walk-ins use normal location/resource/credit rules. Creation does not
-- constitute attendance, and no payment or overbooking exception is granted.
BEGIN;
CREATE FUNCTION public.create_staff_walkin(
  p_kid_id uuid, p_location_id uuid, p_session_type_id uuid,
  p_cage_number text DEFAULT NULL, p_notes text DEFAULT NULL, p_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_payload jsonb := jsonb_build_array('walk_in',p_kid_id,p_location_id,p_session_type_id,p_cage_number,p_notes);
  v_request public.booking_creation_requests%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_type public.session_types%ROWTYPE;
  v_start timestamptz;
  v_result jsonb;
BEGIN
  IF NOT COALESCE(public.can_manage_booking_location(v_tenant,p_location_id),false)
    OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_request FROM public.booking_creation_requests
    WHERE tenant_id=v_tenant AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF v_request.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
    SELECT * INTO v_booking FROM public.bookings WHERE id=v_request.booking_id;
    RETURN to_jsonb(v_booking);
  END IF;
  SELECT * INTO v_type FROM public.session_types
    WHERE id=p_session_type_id AND tenant_id=v_tenant AND is_active;
  IF NOT FOUND OR v_type.type_category NOT IN ('private','cage') THEN
    RAISE EXCEPTION 'event_or_appointment_workflow_required';
  END IF;
  -- Server time, calculated after obtaining the reservation lock. Replays
  -- above retain the original start/end even if the client retries later.
  v_start := clock_timestamp();
  v_result := public.create_staff_booking(
    p_kid_id,p_location_id,p_session_type_id,v_start,
    v_start+make_interval(mins=>v_type.duration_minutes),
    NULL,p_cage_number,p_notes,p_request_id);
  -- The shared creation function owns insertion and credit deduction.
  -- Normalize its receipt to this operation's caller-controlled inputs, not
  -- the server-generated timestamps. Both changes commit or roll back together.
  UPDATE public.booking_creation_requests SET payload=v_payload
    WHERE tenant_id=v_tenant AND actor_id=auth.uid() AND request_id=p_request_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_staff_walkin(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_staff_walkin(uuid,uuid,uuid,text,text,uuid) TO authenticated;
COMMIT;
