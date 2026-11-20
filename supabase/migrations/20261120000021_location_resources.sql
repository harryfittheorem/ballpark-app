BEGIN;
REVOKE INSERT,UPDATE,DELETE ON public.scheduling_resources FROM authenticated,anon;
CREATE TABLE public.scheduling_resource_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.scheduling_resources(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  previous_purpose text,
  purpose text NOT NULL,
  previous_active boolean,
  is_active boolean NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);
ALTER TABLE public.scheduling_resource_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scheduling_resource_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.scheduling_resource_history TO authenticated;
GRANT ALL ON public.scheduling_resource_history TO service_role;
CREATE POLICY resource_history_read ON public.scheduling_resource_history FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id,location_id));

CREATE FUNCTION public.set_scheduling_resource(
  p_location_id uuid,p_cage_number text,p_purpose text,p_active boolean,p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_old public.scheduling_resources%ROWTYPE;
  v_id uuid;
BEGIN
  IF COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','super_admin')
    OR NOT COALESCE(public.can_manage_booking_location(v_tenant,p_location_id),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF p_cage_number IS NULL OR trim(p_cage_number)!~'^[A-Za-z0-9][A-Za-z0-9 -]{0,39}$'
    OR p_purpose IS NULL OR p_purpose NOT IN ('instruction','rental','both')
    OR p_active IS NULL OR NULLIF(trim(p_reason),'') IS NULL OR length(p_reason)>2000
    THEN RAISE EXCEPTION 'resource_name_purpose_and_reason_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_old FROM public.scheduling_resources WHERE tenant_id=v_tenant
    AND location_id=p_location_id AND cage_number=trim(p_cage_number) FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.session_types st ON st.id=b.session_type_id
    WHERE b.tenant_id=v_tenant AND b.location_id=p_location_id AND b.cage_number=trim(p_cage_number)
      AND b.status NOT IN ('cancelled','no_show') AND b.scheduled_end>now()
      AND (NOT p_active OR (p_purpose<>'both' AND p_purpose<>CASE WHEN st.type_category='cage' THEN 'rental' ELSE 'instruction' END))
  ) THEN RAISE EXCEPTION 'resource_has_future_reservations'; END IF;
  IF v_old.id IS NOT NULL AND v_old.purpose=p_purpose AND v_old.is_active=p_active THEN RETURN v_old.id; END IF;
  INSERT INTO public.scheduling_resources(tenant_id,location_id,cage_number,purpose,is_active)
    VALUES(v_tenant,p_location_id,trim(p_cage_number),p_purpose,p_active)
    ON CONFLICT (location_id,cage_number) DO UPDATE SET purpose=EXCLUDED.purpose,is_active=EXCLUDED.is_active
    RETURNING id INTO v_id;
  INSERT INTO public.scheduling_resource_history
    (resource_id,tenant_id,location_id,previous_purpose,purpose,previous_active,is_active,actor_id,reason)
    VALUES(v_id,v_tenant,p_location_id,v_old.purpose,p_purpose,v_old.is_active,p_active,auth.uid(),trim(p_reason));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_scheduling_resource(uuid,text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_scheduling_resource(uuid,text,text,boolean,text) TO authenticated;

CREATE FUNCTION public.is_scheduling_resource_free(
  p_tenant uuid,p_location uuid,p_cage text,p_start timestamptz,p_end timestamptz,
  p_exclude_booking uuid DEFAULT NULL,p_exclude_camp_day uuid DEFAULT NULL
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.tenant_id=p_tenant AND b.location_id=p_location
    AND b.cage_number=p_cage AND b.id IS DISTINCT FROM p_exclude_booking AND b.status NOT IN ('cancelled','no_show')
    AND b.scheduled_start<p_end AND b.scheduled_end>p_start);
$$;
REVOKE ALL ON FUNCTION public.is_scheduling_resource_free(uuid,uuid,text,timestamptz,timestamptz,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.require_booking_resource()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_category text;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.tenant_id,NEW.location_id,NEW.session_type_id,NEW.scheduled_start,NEW.scheduled_end,NEW.cage_number)
    IS NOT DISTINCT FROM ROW(OLD.tenant_id,OLD.location_id,OLD.session_type_id,OLD.scheduled_start,OLD.scheduled_end,OLD.cage_number)
    AND NOT (OLD.status IN ('cancelled','no_show') AND NEW.status NOT IN ('cancelled','no_show')) THEN RETURN NEW; END IF;
  IF NEW.status IN ('cancelled','no_show') THEN RETURN NEW; END IF;
  SELECT type_category INTO v_category FROM public.session_types WHERE id=NEW.session_type_id AND tenant_id=NEW.tenant_id;
  IF v_category='cage' AND NEW.cage_number IS NULL THEN RAISE EXCEPTION 'rental_cage_required'; END IF;
  IF NEW.cage_number IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||NEW.tenant_id::text,0));
    IF NOT public.is_scheduling_resource_free(NEW.tenant_id,NEW.location_id,NEW.cage_number,
      NEW.scheduled_start,NEW.scheduled_end,NEW.id,NULL) THEN RAISE EXCEPTION 'resource_not_available'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER require_booking_resource BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.require_booking_resource();
REVOKE ALL ON FUNCTION public.require_booking_resource() FROM PUBLIC,anon,authenticated;
COMMIT;
