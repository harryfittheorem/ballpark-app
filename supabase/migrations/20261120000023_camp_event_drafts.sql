BEGIN;
CREATE TABLE public.camp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  session_type_id uuid NOT NULL REFERENCES public.session_types(id),
  name text NOT NULL,
  offering_category text NOT NULL CHECK (offering_category IN ('camp','clinic')),
  capacity integer NOT NULL CHECK (capacity>0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','archived')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sales_enabled boolean NOT NULL DEFAULT false,
  financial_policy_reference text,
  financial_policy_approved_by uuid REFERENCES auth.users(id),
  financial_policy_approved_at timestamptz,
  CHECK (NOT sales_enabled OR (NULLIF(trim(financial_policy_reference),'') IS NOT NULL
    AND financial_policy_approved_by IS NOT NULL AND financial_policy_approved_at IS NOT NULL))
);
CREATE TABLE public.camp_event_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.camp_events(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  day_number integer NOT NULL CHECK (day_number>0),
  starts_at timestamptz NOT NULL CHECK (isfinite(starts_at)),
  ends_at timestamptz NOT NULL CHECK (isfinite(ends_at)),
  cage_number text,
  CHECK (ends_at>starts_at),
  UNIQUE (event_id,day_number),
  FOREIGN KEY (location_id,cage_number) REFERENCES public.scheduling_resources(location_id,cage_number)
);
CREATE TABLE public.camp_draft_receipts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.camp_events(id),
  payload jsonb NOT NULL,
  PRIMARY KEY (tenant_id,actor_id,request_id)
);
CREATE TABLE public.camp_purchase_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_id uuid NOT NULL REFERENCES public.camp_events(id),
  kid_id uuid NOT NULL REFERENCES public.kids(id),
  external_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed','cancelled','refunded')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,external_reference)
);
CREATE TABLE public.camp_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  event_id uuid NOT NULL REFERENCES public.camp_events(id),
  confirmation_id uuid NOT NULL UNIQUE REFERENCES public.camp_purchase_confirmations(id),
  kid_id uuid NOT NULL REFERENCES public.kids(id),
  fulfilled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id,kid_id)
);
CREATE TABLE public.camp_roster_entries (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  enrollment_id uuid NOT NULL REFERENCES public.camp_enrollments(id),
  day_id uuid NOT NULL REFERENCES public.camp_event_days(id),
  UNIQUE (enrollment_id,day_id)
);
ALTER TABLE public.camp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_draft_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_purchase_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_roster_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.camp_events,public.camp_event_days,public.camp_draft_receipts,
  public.camp_purchase_confirmations,public.camp_enrollments,public.camp_roster_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.camp_events,public.camp_event_days,public.camp_enrollments,public.camp_roster_entries TO authenticated;
GRANT ALL ON public.camp_events,public.camp_event_days,public.camp_draft_receipts,
  public.camp_purchase_confirmations,public.camp_enrollments,public.camp_roster_entries TO service_role;
CREATE POLICY camp_events_staff_read ON public.camp_events FOR SELECT TO authenticated USING (public.can_manage_booking_location(tenant_id,location_id));
CREATE POLICY camp_days_staff_read ON public.camp_event_days FOR SELECT TO authenticated USING (public.can_manage_booking_location(tenant_id,location_id));
CREATE POLICY camp_enrollments_staff_read ON public.camp_enrollments FOR SELECT TO authenticated USING (public.can_manage_booking_location(tenant_id,location_id));
CREATE POLICY camp_roster_staff_read ON public.camp_roster_entries FOR SELECT TO authenticated USING (public.can_manage_booking_location(tenant_id,location_id));

CREATE FUNCTION public.save_camp_draft(
  p_event_id uuid,p_location_id uuid,p_name text,p_category text,p_session_type_id uuid,
  p_capacity integer,p_days jsonb,p_request_id uuid,p_expected_version integer DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_payload jsonb := jsonb_build_array(p_event_id,p_location_id,p_name,p_category,p_session_type_id,p_capacity,p_days,p_expected_version);
  v_receipt public.camp_draft_receipts%ROWTYPE;
  v_event public.camp_events%ROWTYPE;
  v_id uuid;
  v_day jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_previous_end timestamptz;
  v_number integer := 0;
BEGIN
  IF COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin')
    OR NOT COALESCE(public.can_manage_booking_location(v_tenant,p_location_id),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  IF NULLIF(trim(p_name),'') IS NULL OR length(p_name)>120 OR p_category IS NULL OR p_category NOT IN ('camp','clinic')
    OR p_capacity IS NULL OR p_capacity<=0 OR p_days IS NULL OR jsonb_typeof(p_days)<>'array'
    THEN RAISE EXCEPTION 'camp_name_category_capacity_and_days_required'; END IF;
  IF jsonb_array_length(p_days)<1 OR jsonb_array_length(p_days)>60 THEN RAISE EXCEPTION 'choose_1_to_60_event_days'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_receipt FROM public.camp_draft_receipts WHERE tenant_id=v_tenant AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF v_receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
    RETURN v_receipt.event_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.session_types WHERE id=p_session_type_id AND tenant_id=v_tenant AND is_active AND type_category='group')
    THEN RAISE EXCEPTION 'active_group_event_type_required'; END IF;
  IF p_event_id IS NULL THEN
    INSERT INTO public.camp_events(tenant_id,location_id,session_type_id,name,offering_category,capacity,created_by,updated_by)
      VALUES(v_tenant,p_location_id,p_session_type_id,trim(p_name),p_category,p_capacity,auth.uid(),auth.uid()) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_event FROM public.camp_events WHERE id=p_event_id AND tenant_id=v_tenant AND location_id=p_location_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    IF v_event.status<>'draft' OR v_event.sales_enabled OR EXISTS (SELECT 1 FROM public.camp_enrollments WHERE event_id=p_event_id)
      OR EXISTS (SELECT 1 FROM public.camp_purchase_confirmations WHERE event_id=p_event_id AND status='confirmed')
      THEN RAISE EXCEPTION 'camp_schedule_locked'; END IF;
    IF p_expected_version IS DISTINCT FROM v_event.version THEN RAISE EXCEPTION 'camp_draft_changed_refresh_required'; END IF;
    UPDATE public.camp_events SET name=trim(p_name),offering_category=p_category,session_type_id=p_session_type_id,
      capacity=p_capacity,updated_by=auth.uid(),updated_at=now(),version=version+1 WHERE id=p_event_id;
    DELETE FROM public.camp_event_days WHERE event_id=p_event_id;
    v_id := p_event_id;
  END IF;
  FOR v_day IN SELECT value FROM jsonb_array_elements(p_days) LOOP
    v_start := (v_day->>'starts_at')::timestamptz; v_end := (v_day->>'ends_at')::timestamptz;
    IF v_start IS NULL OR v_end IS NULL OR NOT isfinite(v_start) OR NOT isfinite(v_end)
      OR v_start<=now() OR v_end<=v_start OR (v_previous_end IS NOT NULL AND v_start<v_previous_end)
      THEN RAISE EXCEPTION 'event_days_must_be_future_ordered_and_nonoverlapping'; END IF;
    IF NULLIF(v_day->>'cage_number','') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.scheduling_resources WHERE tenant_id=v_tenant AND location_id=p_location_id
        AND cage_number=v_day->>'cage_number' AND is_active AND purpose IN ('instruction','both')
    ) THEN RAISE EXCEPTION 'camp_instruction_resource_required'; END IF;
    v_number := v_number+1;
    INSERT INTO public.camp_event_days(event_id,tenant_id,location_id,day_number,starts_at,ends_at,cage_number)
      VALUES(v_id,v_tenant,p_location_id,v_number,v_start,v_end,NULLIF(v_day->>'cage_number',''));
    v_previous_end := v_end;
  END LOOP;
  INSERT INTO public.camp_draft_receipts VALUES(v_tenant,auth.uid(),p_request_id,v_id,v_payload);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_camp_draft(uuid,uuid,text,text,uuid,integer,jsonb,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_camp_draft(uuid,uuid,text,text,uuid,integer,jsonb,uuid,integer) TO authenticated;

CREATE FUNCTION public.archive_camp_draft(p_event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_event public.camp_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.camp_events WHERE id=p_event_id;
  IF NOT FOUND OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin')
    OR NOT COALESCE(public.can_manage_booking_location(v_event.tenant_id,v_event.location_id),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_event.tenant_id::text,0));
  SELECT * INTO v_event FROM public.camp_events WHERE id=p_event_id FOR UPDATE;
  IF v_event.status='archived' THEN RETURN; END IF;
  IF v_event.status<>'draft' OR v_event.sales_enabled OR EXISTS (SELECT 1 FROM public.camp_enrollments WHERE event_id=p_event_id)
    OR EXISTS (SELECT 1 FROM public.camp_purchase_confirmations WHERE event_id=p_event_id AND status='confirmed')
    THEN RAISE EXCEPTION 'camp_schedule_locked'; END IF;
  UPDATE public.camp_events SET status='archived',updated_by=auth.uid(),updated_at=now(),version=version+1 WHERE id=p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_camp_draft(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.archive_camp_draft(uuid) TO authenticated;
COMMIT;
