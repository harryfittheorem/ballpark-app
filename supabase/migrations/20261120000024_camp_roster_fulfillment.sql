BEGIN;
-- No checkout, payment webhook or client route enables this. Both a trusted
-- confirmed-purchase record and explicit future financial approval are needed.
CREATE FUNCTION public.fulfill_confirmed_camp_purchase(p_confirmation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_purchase public.camp_purchase_confirmations%ROWTYPE;
  v_event public.camp_events%ROWTYPE;
  v_enrollment public.camp_enrollments%ROWTYPE;
  v_day public.camp_event_days%ROWTYPE;
  v_booking uuid;
  v_ids jsonb;
BEGIN
  IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO v_purchase FROM public.camp_purchase_confirmations WHERE id=p_confirmation_id;
  IF NOT FOUND OR v_purchase.status<>'confirmed' THEN RAISE EXCEPTION 'confirmed_camp_purchase_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_purchase.tenant_id::text,0));
  SELECT * INTO v_purchase FROM public.camp_purchase_confirmations WHERE id=p_confirmation_id FOR UPDATE;
  IF v_purchase.status<>'confirmed' THEN RAISE EXCEPTION 'confirmed_camp_purchase_required'; END IF;
  SELECT * INTO v_event FROM public.camp_events WHERE id=v_purchase.event_id AND tenant_id=v_purchase.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_camp_purchase_references'; END IF;
  SELECT * INTO v_enrollment FROM public.camp_enrollments WHERE confirmation_id=v_purchase.id;
  IF NOT FOUND THEN
    IF v_event.status<>'ready' OR NOT v_event.sales_enabled OR v_event.financial_policy_approved_at IS NULL
      OR v_event.financial_policy_approved_by IS NULL OR NULLIF(trim(v_event.financial_policy_reference),'') IS NULL
      THEN RAISE EXCEPTION 'camp_sales_disabled'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.kids k JOIN public.families f ON f.id=k.family_id
      WHERE k.id=v_purchase.kid_id AND f.tenant_id=v_event.tenant_id
        AND f.primary_location_id=v_event.location_id) THEN RAISE EXCEPTION 'invalid_camp_purchase_references'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.camp_event_days WHERE event_id=v_event.id)
      OR EXISTS (SELECT 1 FROM public.camp_event_days WHERE event_id=v_event.id AND starts_at<=now())
      THEN RAISE EXCEPTION 'full_future_camp_schedule_required'; END IF;
    IF EXISTS (SELECT 1 FROM public.camp_enrollments WHERE event_id=v_event.id AND kid_id=v_purchase.kid_id)
      THEN RAISE EXCEPTION 'athlete_already_enrolled_requires_payment_review'; END IF;
    IF (SELECT count(*) FROM public.camp_enrollments WHERE event_id=v_event.id)>=v_event.capacity THEN RAISE EXCEPTION 'camp_capacity_reached'; END IF;
    INSERT INTO public.camp_enrollments(tenant_id,location_id,event_id,confirmation_id,kid_id)
      VALUES(v_event.tenant_id,v_event.location_id,v_event.id,v_purchase.id,v_purchase.kid_id) RETURNING * INTO v_enrollment;
    PERFORM set_config('app.camp_fulfillment','on',true);
    FOR v_day IN SELECT * FROM public.camp_event_days WHERE event_id=v_event.id ORDER BY day_number LOOP
      IF v_day.tenant_id<>v_event.tenant_id OR v_day.location_id<>v_event.location_id THEN RAISE EXCEPTION 'invalid_camp_day_references'; END IF;
      IF v_day.cage_number IS NOT NULL AND (
        NOT EXISTS (SELECT 1 FROM public.scheduling_resources WHERE tenant_id=v_event.tenant_id
          AND location_id=v_event.location_id AND cage_number=v_day.cage_number AND is_active AND purpose IN ('instruction','both'))
        OR NOT public.is_scheduling_resource_free(v_event.tenant_id,v_event.location_id,v_day.cage_number,v_day.starts_at,v_day.ends_at,NULL,v_day.id)
      ) THEN RAISE EXCEPTION 'camp_resource_not_available'; END IF;
      -- A confirmed camp purchase is the event entitlement. Membership lesson
      -- credits are neither charged nor fabricated; facility guards still run.
      INSERT INTO public.bookings(tenant_id,location_id,kid_id,coach_id,session_type_id,scheduled_start,scheduled_end,status)
        VALUES(v_event.tenant_id,v_event.location_id,v_purchase.kid_id,NULL,v_event.session_type_id,v_day.starts_at,v_day.ends_at,'confirmed')
        RETURNING id INTO v_booking;
      INSERT INTO public.camp_roster_entries(booking_id,tenant_id,location_id,enrollment_id,day_id)
        VALUES(v_booking,v_event.tenant_id,v_event.location_id,v_enrollment.id,v_day.id);
    END LOOP;
    PERFORM set_config('app.camp_fulfillment','off',true);
  END IF;
  SELECT jsonb_agg(r.booking_id ORDER BY d.day_number) INTO v_ids FROM public.camp_roster_entries r
    JOIN public.camp_event_days d ON d.id=r.day_id WHERE r.enrollment_id=v_enrollment.id;
  RETURN jsonb_build_object('enrollment_id',v_enrollment.id,'booking_ids',v_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.fulfill_confirmed_camp_purchase(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_confirmed_camp_purchase(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_scheduling_resource_free(
  p_tenant uuid,p_location uuid,p_cage text,p_start timestamptz,p_end timestamptz,
  p_exclude_booking uuid DEFAULT NULL,p_exclude_camp_day uuid DEFAULT NULL
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.tenant_id=p_tenant AND b.location_id=p_location
    AND b.cage_number=p_cage AND b.id IS DISTINCT FROM p_exclude_booking AND b.status NOT IN ('cancelled','no_show')
    AND b.scheduled_start<p_end AND b.scheduled_end>p_start)
  AND NOT EXISTS (SELECT 1 FROM public.camp_event_days d WHERE d.tenant_id=p_tenant AND d.location_id=p_location
    AND d.cage_number=p_cage AND d.id IS DISTINCT FROM p_exclude_camp_day
    AND d.starts_at<p_end AND d.ends_at>p_start
    AND EXISTS (SELECT 1 FROM public.camp_enrollments e WHERE e.event_id=d.event_id));
$$;
COMMIT;
