BEGIN;
CREATE FUNCTION public.set_booking_capacity_override(
  p_location_id uuid,p_category text,p_start timestamptz,p_end timestamptz,p_capacity integer,p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_old public.scheduling_capacity_overrides%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT COALESCE(public.can_override_booking_capacity(v_tenant,p_location_id),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('lesson','rental') OR p_start IS NULL OR p_end IS NULL
    OR NOT isfinite(p_start) OR NOT isfinite(p_end) OR p_end<=p_start OR p_end<=now()
    OR p_capacity IS NULL OR p_capacity<=0 OR NULLIF(trim(p_reason),'') IS NULL OR length(p_reason)>2000
    THEN RAISE EXCEPTION 'valid_window_capacity_and_reason_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  IF NOT EXISTS (SELECT 1 FROM public.scheduling_location_rules WHERE tenant_id=v_tenant AND location_id=p_location_id
    AND approved_at IS NOT NULL AND capacity_source='manual'
    AND CASE WHEN p_category='rental' THEN rental_capacity ELSE lesson_capacity END IS NOT NULL)
    THEN RAISE EXCEPTION 'capacity_policy_required'; END IF;
  SELECT * INTO v_old FROM public.scheduling_capacity_overrides
    WHERE tenant_id=v_tenant AND location_id=p_location_id AND category=p_category
      AND starts_at=p_start AND ends_at=p_end FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.scheduling_capacity_overrides WHERE tenant_id=v_tenant AND location_id=p_location_id
    AND category=p_category AND is_active AND starts_at<p_end AND ends_at>p_start AND id IS DISTINCT FROM v_old.id)
    THEN RAISE EXCEPTION 'overlapping_capacity_override'; END IF;
  IF v_old.is_active AND v_old.capacity=p_capacity AND v_old.reason=trim(p_reason) THEN RETURN v_old.id; END IF;
  INSERT INTO public.scheduling_capacity_overrides
    (tenant_id,location_id,category,starts_at,ends_at,capacity,reason,updated_by)
    VALUES(v_tenant,p_location_id,p_category,p_start,p_end,p_capacity,trim(p_reason),auth.uid())
    ON CONFLICT (location_id,category,starts_at,ends_at) DO UPDATE SET capacity=EXCLUDED.capacity,
      reason=EXCLUDED.reason,is_active=true,updated_by=EXCLUDED.updated_by,updated_at=now()
    RETURNING id INTO v_id;
  IF NOT public.booking_capacity_has_room(v_tenant,p_location_id,p_category='rental',greatest(p_start,now()),p_end,NULL,0)
    THEN RAISE EXCEPTION 'capacity_below_existing_reservations'; END IF;
  INSERT INTO public.scheduling_override_history
    (override_id,tenant_id,location_id,category,starts_at,ends_at,previous_capacity,new_capacity,actor_id,reason)
    VALUES(v_id,v_tenant,p_location_id,p_category,p_start,p_end,
      CASE WHEN v_old.is_active THEN v_old.capacity ELSE NULL END,p_capacity,auth.uid(),trim(p_reason));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_booking_capacity_override(uuid,text,timestamptz,timestamptz,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_booking_capacity_override(uuid,text,timestamptz,timestamptz,integer,text) TO authenticated;

CREATE FUNCTION public.remove_booking_capacity_override(p_override_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old public.scheduling_capacity_overrides%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.scheduling_capacity_overrides WHERE id=p_override_id;
  IF NOT FOUND OR NOT COALESCE(public.can_override_booking_capacity(v_old.tenant_id,v_old.location_id),false)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(trim(p_reason),'') IS NULL OR length(p_reason)>2000 THEN RAISE EXCEPTION 'reason_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_old.tenant_id::text,0));
  SELECT * INTO v_old FROM public.scheduling_capacity_overrides WHERE id=p_override_id FOR UPDATE;
  IF NOT v_old.is_active THEN RETURN; END IF;
  UPDATE public.scheduling_capacity_overrides SET is_active=false,updated_by=auth.uid(),updated_at=now() WHERE id=p_override_id;
  IF v_old.ends_at>now() AND NOT public.booking_capacity_has_room(v_old.tenant_id,v_old.location_id,
    v_old.category='rental',greatest(v_old.starts_at,now()),v_old.ends_at,NULL,0)
    THEN RAISE EXCEPTION 'capacity_below_existing_reservations'; END IF;
  INSERT INTO public.scheduling_override_history
    (override_id,tenant_id,location_id,category,starts_at,ends_at,previous_capacity,new_capacity,actor_id,reason)
    VALUES(v_old.id,v_old.tenant_id,v_old.location_id,v_old.category,v_old.starts_at,v_old.ends_at,
      v_old.capacity,NULL,auth.uid(),trim(p_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.remove_booking_capacity_override(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_booking_capacity_override(uuid,text) TO authenticated;

-- Normal-limit changes must respect existing dated exceptions as well. This
-- avoids rejecting an unchanged base limit just because an approved exception
-- legitimately contains more bookings.
CREATE OR REPLACE FUNCTION public.set_manual_location_capacity(
  p_location_id uuid,p_lesson_capacity integer,p_rental_capacity integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_previous public.scheduling_location_rules%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','super_admin')
    OR NOT COALESCE(public.can_manage_booking_location(v_tenant,p_location_id),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF p_lesson_capacity IS NULL OR p_rental_capacity IS NULL OR p_lesson_capacity<=0 OR p_rental_capacity<=0
    THEN RAISE EXCEPTION 'positive_capacity_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_previous FROM public.scheduling_location_rules WHERE location_id=p_location_id AND tenant_id=v_tenant FOR UPDATE;
  INSERT INTO public.scheduling_location_rules
    (tenant_id,location_id,lesson_capacity,rental_capacity,capacity_source,approved_by,approved_at)
    VALUES(v_tenant,p_location_id,p_lesson_capacity,p_rental_capacity,'manual',auth.uid(),now())
    ON CONFLICT (location_id) DO UPDATE SET lesson_capacity=EXCLUDED.lesson_capacity,rental_capacity=EXCLUDED.rental_capacity,
      capacity_source='manual',approved_by=EXCLUDED.approved_by,approved_at=EXCLUDED.approved_at;
  IF NOT public.booking_capacity_has_room(v_tenant,p_location_id,false,now(),'infinity'::timestamptz,NULL,0)
    OR NOT public.booking_capacity_has_room(v_tenant,p_location_id,true,now(),'infinity'::timestamptz,NULL,0)
    THEN RAISE EXCEPTION 'capacity_below_existing_reservations'; END IF;
  INSERT INTO public.scheduling_capacity_history
    (tenant_id,location_id,actor_id,previous_lesson_capacity,previous_rental_capacity,lesson_capacity,rental_capacity)
    VALUES(v_tenant,p_location_id,auth.uid(),v_previous.lesson_capacity,v_previous.rental_capacity,p_lesson_capacity,p_rental_capacity);
END;
$$;
COMMIT;
