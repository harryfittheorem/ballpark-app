-- Recurrence uses existing credits at creation. Every occurrence must pass;
-- a failed occurrence rolls back the entire series and every deduction.
BEGIN;
CREATE TABLE public.booking_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  kid_id uuid NOT NULL REFERENCES public.kids(id),
  session_type_id uuid NOT NULL REFERENCES public.session_types(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL,
  UNIQUE (tenant_id,created_by,request_id)
);
CREATE TABLE public.booking_series_occurrences (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE RESTRICT,
  series_id uuid NOT NULL REFERENCES public.booking_series(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  occurrence_number integer NOT NULL CHECK (occurrence_number>0),
  original_start timestamptz NOT NULL,
  UNIQUE (series_id,occurrence_number)
);
ALTER TABLE public.booking_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_series_occurrences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_series,public.booking_series_occurrences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.booking_series,public.booking_series_occurrences TO authenticated;
GRANT ALL ON public.booking_series,public.booking_series_occurrences TO service_role;
CREATE POLICY series_staff_read ON public.booking_series FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id,location_id));
CREATE POLICY occurrences_staff_read ON public.booking_series_occurrences FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id,location_id));

CREATE FUNCTION public.create_staff_booking_series(
  p_kid_id uuid,p_location_id uuid,p_session_type_id uuid,p_starts timestamptz[],
  p_cage_number text DEFAULT NULL,p_notes text DEFAULT NULL,p_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_payload jsonb := jsonb_build_array('series',p_kid_id,p_location_id,p_session_type_id,p_starts,p_cage_number,p_notes);
  v_request public.booking_creation_requests%ROWTYPE;
  v_series_id uuid;
  v_type public.session_types%ROWTYPE;
  v_start timestamptz;
  v_previous timestamptz;
  v_number integer := 0;
  v_booking jsonb;
  v_bookings jsonb;
  v_first_booking uuid;
BEGIN
  IF NOT COALESCE(public.can_manage_booking_location(v_tenant,p_location_id),false)
    OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  -- 52 is a request-size safety bound, not a business entitlement.
  IF p_starts IS NULL OR cardinality(p_starts)<2 OR cardinality(p_starts)>52
    OR array_ndims(p_starts)<>1 THEN RAISE EXCEPTION 'choose_2_to_52_occurrences'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_request FROM public.booking_creation_requests
    WHERE tenant_id=v_tenant AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF v_request.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
    SELECT id INTO v_series_id FROM public.booking_series
      WHERE tenant_id=v_tenant AND created_by=auth.uid() AND request_id=p_request_id;
    IF v_series_id IS NULL THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
  ELSE
    SELECT * INTO v_type FROM public.session_types
      WHERE id=p_session_type_id AND tenant_id=v_tenant AND is_active;
    IF NOT FOUND OR v_type.type_category NOT IN ('private','cage') THEN
      RAISE EXCEPTION 'event_or_appointment_workflow_required';
    END IF;
    INSERT INTO public.booking_series(tenant_id,location_id,kid_id,session_type_id,created_by,request_id)
      VALUES(v_tenant,p_location_id,p_kid_id,p_session_type_id,auth.uid(),p_request_id)
      RETURNING id INTO v_series_id;
    FOREACH v_start IN ARRAY p_starts LOOP
      IF v_start IS NULL OR NOT isfinite(v_start) OR v_start<=now()
        OR (v_previous IS NOT NULL AND (v_start<=v_previous OR v_start<v_previous+make_interval(mins=>v_type.duration_minutes))) THEN
        RAISE EXCEPTION 'occurrences_must_be_future_unique_and_in_order';
      END IF;
      v_number := v_number+1;
      v_booking := public.create_staff_booking(
        p_kid_id,p_location_id,p_session_type_id,v_start,
        v_start+make_interval(mins=>v_type.duration_minutes),
        NULL,p_cage_number,p_notes,gen_random_uuid());
      IF v_first_booking IS NULL THEN v_first_booking := (v_booking->>'id')::uuid; END IF;
      INSERT INTO public.booking_series_occurrences
        (booking_id,series_id,tenant_id,location_id,occurrence_number,original_start)
        VALUES((v_booking->>'id')::uuid,v_series_id,v_tenant,p_location_id,v_number,v_start);
      v_previous := v_start;
    END LOOP;
    -- Use the same actor/request namespace as one-off bookings and walk-ins.
    -- A retry cannot accidentally create another kind of booking.
    INSERT INTO public.booking_creation_requests(tenant_id,actor_id,request_id,payload,booking_id)
      VALUES(v_tenant,auth.uid(),p_request_id,v_payload,v_first_booking);
  END IF;
  SELECT jsonb_agg(to_jsonb(b) ORDER BY o.occurrence_number) INTO v_bookings
    FROM public.booking_series_occurrences o JOIN public.bookings b ON b.id=o.booking_id
    WHERE o.series_id=v_series_id AND o.tenant_id=v_tenant;
  RETURN jsonb_build_object('series_id',v_series_id,'bookings',v_bookings);
END;
$$;
REVOKE ALL ON FUNCTION public.create_staff_booking_series(uuid,uuid,uuid,timestamptz[],text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_staff_booking_series(uuid,uuid,uuid,timestamptz[],text,text,uuid) TO authenticated;
COMMIT;
