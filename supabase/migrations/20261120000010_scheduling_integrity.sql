-- Scheduling contract. No default facility capacity or camp financial policy
-- is invented here. New pooled bookings fail closed until location rules exist.
BEGIN;

ALTER TABLE public.bookings
  ALTER COLUMN coach_id DROP NOT NULL,
  ADD COLUMN actual_coach_id uuid;

CREATE TABLE public.scheduling_location_rules (
  location_id uuid PRIMARY KEY REFERENCES public.locations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  lesson_capacity integer CHECK (lesson_capacity > 0),
  rental_capacity integer CHECK (rental_capacity > 0),
  capacity_source text NOT NULL DEFAULT 'pending' CHECK (capacity_source IN ('pending', 'manual', 'availability')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  instructor_corrections_approved boolean NOT NULL DEFAULT false,
  correction_roles text[] NOT NULL DEFAULT '{}' CHECK (correction_roles <@ ARRAY['owner','admin','super_admin','coach']::text[]),
  CHECK ((approved_by IS NULL) = (approved_at IS NULL))
);
CREATE TABLE public.scheduling_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  cage_number text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('instruction', 'rental', 'both')),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (location_id, cage_number)
);
ALTER TABLE public.scheduling_location_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_resources ENABLE ROW LEVEL SECURITY;

-- Existing roles only. A coach's assigned locations are authoritative; staff
-- preset alone never grants access to a different location.
CREATE FUNCTION public.can_manage_booking_location(p_tenant_id uuid, p_location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_tenant_id = (auth.jwt()->>'tenant_id')::uuid
    AND EXISTS (SELECT 1 FROM public.locations WHERE id=p_location_id AND tenant_id=p_tenant_id)
    AND (
      auth.jwt()->>'app_role' IN ('owner','super_admin')
      OR (auth.jwt()->>'app_role'='admin' AND EXISTS (
        SELECT 1 FROM public.staff_locations WHERE user_id=auth.uid() AND location_id=p_location_id))
      OR (auth.jwt()->>'app_role'='coach' AND EXISTS (
        SELECT 1 FROM public.coaches c JOIN public.coach_locations cl ON cl.coach_id=c.id
        WHERE c.user_id=auth.uid() AND c.tenant_id=p_tenant_id AND c.is_active AND cl.location_id=p_location_id))
    );
$$;
REVOKE ALL ON FUNCTION public.can_manage_booking_location(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_booking_location(uuid, uuid) TO authenticated;
CREATE POLICY rules_read ON public.scheduling_location_rules FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id, location_id));
CREATE POLICY resources_read ON public.scheduling_resources FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id, location_id));
GRANT SELECT ON public.scheduling_location_rules, public.scheduling_resources TO authenticated;
-- Configuration is intentionally service-only until resource/capacity policy
-- and the permission matrix have been approved.
GRANT ALL ON public.scheduling_location_rules, public.scheduling_resources TO service_role;

CREATE TABLE public.booking_creation_requests (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  PRIMARY KEY (tenant_id, actor_id, request_id)
);
ALTER TABLE public.booking_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_creation_requests FROM anon, authenticated;
GRANT ALL ON public.booking_creation_requests TO service_role;

-- Common invariant for staff, direct mobile inserts, public RPCs and waitlist
-- promotion. One tenant lock covers differently-starting overlapping ranges,
-- including cage reassignment. An hour-bucket lock cannot do that.
CREATE FUNCTION public.enforce_booking_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_type public.session_types%ROWTYPE;
  v_rules public.scheduling_location_rules%ROWTYPE;
  v_capacity integer;
BEGIN
  IF TG_OP='UPDATE' AND
    ROW(NEW.tenant_id,NEW.location_id,NEW.kid_id,NEW.coach_id,NEW.session_type_id,NEW.scheduled_start,NEW.scheduled_end,NEW.cage_number)
    IS NOT DISTINCT FROM
    ROW(OLD.tenant_id,OLD.location_id,OLD.kid_id,OLD.coach_id,OLD.session_type_id,OLD.scheduled_start,OLD.scheduled_end,OLD.cage_number)
    AND NOT (OLD.status IN ('cancelled','no_show') AND NEW.status NOT IN ('cancelled','no_show')) THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_change_forbidden';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||NEW.tenant_id::text,0));
  SELECT * INTO v_type FROM public.session_types WHERE id=NEW.session_type_id AND tenant_id=NEW.tenant_id AND is_active;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.locations WHERE id=NEW.location_id AND tenant_id=NEW.tenant_id)
    OR (NEW.kid_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kids k JOIN public.families f ON f.id=k.family_id WHERE k.id=NEW.kid_id AND f.tenant_id=NEW.tenant_id)) THEN
    RAISE EXCEPTION 'invalid_booking_references';
  END IF;
  IF NEW.coach_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.coaches c JOIN public.coach_locations cl ON cl.coach_id=c.id
    WHERE c.id=NEW.coach_id AND c.tenant_id=NEW.tenant_id AND c.is_active AND cl.location_id=NEW.location_id
  ) THEN RAISE EXCEPTION 'coach_not_eligible_at_location'; END IF;
  IF NEW.scheduled_start IS NULL OR NEW.scheduled_end IS NULL OR NOT isfinite(NEW.scheduled_start)
    OR NOT isfinite(NEW.scheduled_end) OR NEW.scheduled_end <= NEW.scheduled_start THEN RAISE EXCEPTION 'invalid_booking_dates'; END IF;
  IF NEW.status IN ('cancelled','no_show') THEN RETURN NEW; END IF;
  IF NEW.cage_number IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.scheduling_resources r WHERE r.tenant_id=NEW.tenant_id
      AND r.location_id=NEW.location_id AND r.cage_number=NEW.cage_number AND r.is_active
      AND (r.purpose='both' OR r.purpose=CASE WHEN v_type.type_category='cage' THEN 'rental' ELSE 'instruction' END))
    THEN RAISE EXCEPTION 'resource_policy_required'; END IF;
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id
      AND b.location_id=NEW.location_id AND b.cage_number=NEW.cage_number
      AND b.status NOT IN ('cancelled','no_show')
      AND b.scheduled_start<NEW.scheduled_end AND b.scheduled_end>NEW.scheduled_start)
    THEN RAISE EXCEPTION 'resource_not_available'; END IF;
  END IF;
  -- Preserve the existing coach-slot capacity contract for legacy consumers.
  -- Pooled (no scheduled coach) bookings require explicitly approved capacity.
  IF NEW.coach_id IS NULL THEN
    SELECT * INTO v_rules FROM public.scheduling_location_rules
      WHERE location_id=NEW.location_id AND tenant_id=NEW.tenant_id AND approved_at IS NOT NULL;
    IF NOT FOUND OR v_rules.capacity_source <> 'manual' THEN RAISE EXCEPTION 'capacity_policy_required'; END IF;
    v_capacity := CASE WHEN v_type.type_category='cage' THEN v_rules.rental_capacity ELSE v_rules.lesson_capacity END;
    IF v_capacity IS NULL THEN RAISE EXCEPTION 'capacity_policy_required'; END IF;
    IF (SELECT count(*) FROM public.bookings b JOIN public.session_types st ON st.id=b.session_type_id
      WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.location_id=NEW.location_id
      AND (st.type_category='cage')=(v_type.type_category='cage') AND b.status NOT IN ('cancelled','no_show')
      AND b.scheduled_start<NEW.scheduled_end AND b.scheduled_end>NEW.scheduled_start) >= v_capacity
    THEN RAISE EXCEPTION 'slot_not_available'; END IF;
  ELSE
    -- A location with an approved pooled limit must also count legacy writes.
    SELECT * INTO v_rules FROM public.scheduling_location_rules
      WHERE location_id=NEW.location_id AND tenant_id=NEW.tenant_id AND approved_at IS NOT NULL AND capacity_source='manual';
    v_capacity := CASE WHEN v_type.type_category='cage' THEN v_rules.rental_capacity ELSE v_rules.lesson_capacity END;
    IF v_capacity IS NOT NULL AND (SELECT count(*) FROM public.bookings b JOIN public.session_types st ON st.id=b.session_type_id
      WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.location_id=NEW.location_id
      AND (st.type_category='cage')=(v_type.type_category='cage') AND b.status NOT IN ('cancelled','no_show')
      AND b.scheduled_start<NEW.scheduled_end AND b.scheduled_end>NEW.scheduled_start) >= v_capacity
    THEN RAISE EXCEPTION 'slot_not_available'; END IF;
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.coach_id=NEW.coach_id
      AND b.status NOT IN ('cancelled','no_show') AND b.scheduled_start<NEW.scheduled_end AND b.scheduled_end>NEW.scheduled_start
      AND ROW(b.session_type_id,b.scheduled_start,b.scheduled_end) IS DISTINCT FROM ROW(NEW.session_type_id,NEW.scheduled_start,NEW.scheduled_end))
      OR (SELECT count(*) FROM public.bookings b WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.coach_id=NEW.coach_id
        AND b.session_type_id=NEW.session_type_id AND b.status NOT IN ('cancelled','no_show')
        AND b.scheduled_start<NEW.scheduled_end AND b.scheduled_end>NEW.scheduled_start) >= v_type.capacity
    THEN RAISE EXCEPTION 'slot_not_available'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_booking_reservation BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_reservation();
REVOKE ALL ON FUNCTION public.enforce_booking_reservation() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_staff_booking(
  p_kid_id uuid, p_location_id uuid, p_session_type_id uuid,
  p_scheduled_start timestamptz, p_scheduled_end timestamptz,
  p_coach_id uuid DEFAULT NULL, p_cage_number text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_booking public.bookings%ROWTYPE;
  v_request public.booking_creation_requests%ROWTYPE;
  v_payload jsonb := jsonb_build_array(p_kid_id,p_location_id,p_session_type_id,p_scheduled_start,p_scheduled_end,p_coach_id,p_cage_number,p_notes);
  v_type public.session_types%ROWTYPE;
BEGIN
  IF NOT COALESCE(public.can_manage_booking_location(v_tenant,p_location_id),false)
    OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin')
  THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_request FROM public.booking_creation_requests
    WHERE tenant_id=v_tenant AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF v_request.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
    SELECT * INTO v_booking FROM public.bookings WHERE id=v_request.booking_id;
    RETURN to_jsonb(v_booking);
  END IF;
  SELECT * INTO v_type FROM public.session_types WHERE id=p_session_type_id AND tenant_id=v_tenant AND is_active;
  IF NOT FOUND OR v_type.type_category NOT IN ('private','cage') THEN RAISE EXCEPTION 'event_or_appointment_workflow_required'; END IF;
  IF p_scheduled_start IS NULL OR NOT isfinite(p_scheduled_start) OR p_scheduled_start<now() OR
    p_scheduled_end IS DISTINCT FROM p_scheduled_start + make_interval(mins=>v_type.duration_minutes)
  THEN RAISE EXCEPTION 'invalid_booking_dates_or_duration'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids k JOIN public.families f ON f.id=k.family_id
    WHERE k.id=p_kid_id AND f.tenant_id=v_tenant AND f.primary_location_id=p_location_id)
  THEN RAISE EXCEPTION 'athlete_not_at_location'; END IF;
  -- Reuse the established entitlement check/deduction in the SAME transaction.
  -- Any capacity/resource failure rolls back the deduction.
  INSERT INTO public.bookings(tenant_id,location_id,kid_id,coach_id,session_type_id,scheduled_start,scheduled_end,cage_number,notes,status)
  VALUES(v_tenant,p_location_id,p_kid_id,p_coach_id,p_session_type_id,p_scheduled_start,p_scheduled_end,p_cage_number,p_notes,'confirmed')
  RETURNING * INTO v_booking;
  PERFORM public.deduct_session_credit(v_booking.id);
  INSERT INTO public.booking_creation_requests VALUES(v_tenant,auth.uid(),p_request_id,v_payload,v_booking.id);
  RETURN to_jsonb(v_booking);
END;
$$;
REVOKE ALL ON FUNCTION public.create_staff_booking(uuid,uuid,uuid,timestamptz,timestamptz,uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_staff_booking(uuid,uuid,uuid,timestamptz,timestamptz,uuid,text,text,uuid) TO authenticated;

CREATE FUNCTION public.assign_booking_cage(p_booking_id uuid,p_cage_number text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(public.can_manage_booking_location(b.tenant_id,b.location_id),false)
    OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin','super_admin')
  THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  UPDATE public.bookings SET cage_number=p_cage_number WHERE id=b.id;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_booking_cage(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_booking_cage(uuid,text) TO authenticated;

COMMIT;
