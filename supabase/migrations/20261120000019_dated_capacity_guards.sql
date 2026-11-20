BEGIN;
CREATE TABLE public.scheduling_capacity_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  category text NOT NULL CHECK (category IN ('lesson','rental')),
  starts_at timestamptz NOT NULL CHECK (isfinite(starts_at)),
  ends_at timestamptz NOT NULL CHECK (isfinite(ends_at)),
  capacity integer NOT NULL CHECK (capacity>0),
  reason text NOT NULL CHECK (length(trim(reason))>0),
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at>starts_at),
  UNIQUE (location_id,category,starts_at,ends_at)
);
CREATE TABLE public.scheduling_override_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id uuid NOT NULL REFERENCES public.scheduling_capacity_overrides(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  category text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  previous_capacity integer,
  new_capacity integer,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);
ALTER TABLE public.scheduling_capacity_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_override_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scheduling_capacity_overrides,public.scheduling_override_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.scheduling_capacity_overrides,public.scheduling_override_history TO authenticated;
GRANT ALL ON public.scheduling_capacity_overrides,public.scheduling_override_history TO service_role;
CREATE POLICY overrides_staff_read ON public.scheduling_capacity_overrides FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id,location_id));
CREATE POLICY override_history_staff_read ON public.scheduling_override_history FOR SELECT TO authenticated
  USING (public.can_manage_booking_location(tenant_id,location_id));

CREATE FUNCTION public.can_override_booking_capacity(p_tenant_id uuid,p_location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT COALESCE(auth.jwt()->>'app_role' IN ('owner','admin','super_admin'),false)
    AND public.can_manage_booking_location(p_tenant_id,p_location_id);
$$;
REVOKE ALL ON FUNCTION public.can_override_booking_capacity(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_override_booking_capacity(uuid,uuid) TO authenticated;

-- Called only under the tenant reservation lock. Check every occupancy and
-- override boundary, not just the booking start or total intersecting rows.
-- p_add=1 checks a prospective booking; p_add=0 validates a policy change.
CREATE FUNCTION public.booking_capacity_has_room(
  p_tenant uuid,p_location uuid,p_rental boolean,p_start timestamptz,p_end timestamptz,
  p_exclude uuid DEFAULT NULL,p_add integer DEFAULT 1
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH base AS (
    SELECT CASE WHEN p_rental THEN rental_capacity ELSE lesson_capacity END AS capacity
    FROM public.scheduling_location_rules WHERE tenant_id=p_tenant AND location_id=p_location
      AND capacity_source='manual' AND approved_at IS NOT NULL
  ), reservations AS (
    SELECT b.scheduled_start AS starts,b.scheduled_end AS ends
    FROM public.bookings b JOIN public.session_types st ON st.id=b.session_type_id
    WHERE b.tenant_id=p_tenant AND b.location_id=p_location AND b.id IS DISTINCT FROM p_exclude
      AND (st.type_category='cage')=p_rental AND b.status NOT IN ('cancelled','no_show')
      AND b.scheduled_start<p_end AND b.scheduled_end>p_start
  ), windows AS (
    SELECT starts_at,ends_at,capacity FROM public.scheduling_capacity_overrides
    WHERE tenant_id=p_tenant AND location_id=p_location AND is_active
      AND category=CASE WHEN p_rental THEN 'rental' ELSE 'lesson' END
      AND starts_at<p_end AND ends_at>p_start
  ), boundaries AS (
    SELECT p_start AS moment
    UNION SELECT greatest(starts,p_start) FROM reservations
    UNION SELECT ends FROM reservations WHERE ends<p_end
    UNION SELECT greatest(starts_at,p_start) FROM windows
    UNION SELECT ends_at FROM windows WHERE ends_at<p_end
  )
  SELECT NOT EXISTS (
    SELECT 1 FROM boundaries t
    WHERE (SELECT count(*) FROM reservations r WHERE r.starts<=t.moment AND r.ends>t.moment)+p_add
      > COALESCE((SELECT min(w.capacity) FROM windows w WHERE w.starts_at<=t.moment AND w.ends_at>t.moment),
                 (SELECT capacity FROM base))
  ) AND EXISTS (SELECT 1 FROM base WHERE capacity IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.booking_capacity_has_room(uuid,uuid,boolean,timestamptz,timestamptz,uuid,integer)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enforce_booking_reservation()
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
    AND NOT (OLD.status IN ('cancelled','no_show') AND NEW.status NOT IN ('cancelled','no_show')) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN RAISE EXCEPTION 'tenant_change_forbidden'; END IF;
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
    OR NOT isfinite(NEW.scheduled_end) OR NEW.scheduled_end<=NEW.scheduled_start THEN RAISE EXCEPTION 'invalid_booking_dates'; END IF;
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
  SELECT * INTO v_rules FROM public.scheduling_location_rules WHERE location_id=NEW.location_id
    AND tenant_id=NEW.tenant_id AND approved_at IS NOT NULL AND capacity_source='manual';
  v_capacity := CASE WHEN v_type.type_category='cage' THEN v_rules.rental_capacity ELSE v_rules.lesson_capacity END;
  IF NEW.coach_id IS NULL AND v_capacity IS NULL THEN RAISE EXCEPTION 'capacity_policy_required'; END IF;
  IF v_capacity IS NOT NULL AND NOT public.booking_capacity_has_room(NEW.tenant_id,NEW.location_id,
    v_type.type_category='cage',NEW.scheduled_start,NEW.scheduled_end,NEW.id,1)
    THEN RAISE EXCEPTION 'slot_not_available'; END IF;
  -- Preserve the legacy internal coach-slot contract as an additional guard.
  IF NEW.coach_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.coach_id=NEW.coach_id
      AND b.status NOT IN ('cancelled','no_show') AND b.scheduled_start<NEW.scheduled_end AND b.scheduled_end>NEW.scheduled_start
      AND ROW(b.session_type_id,b.scheduled_start,b.scheduled_end) IS DISTINCT FROM ROW(NEW.session_type_id,NEW.scheduled_start,NEW.scheduled_end))
    OR (SELECT count(*) FROM public.bookings b WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.coach_id=NEW.coach_id
      AND b.session_type_id=NEW.session_type_id AND b.status NOT IN ('cancelled','no_show')
      AND b.scheduled_start<NEW.scheduled_end AND b.scheduled_end>NEW.scheduled_start)>=v_type.capacity
  ) THEN RAISE EXCEPTION 'slot_not_available'; END IF;
  RETURN NEW;
END;
$$;
COMMIT;
