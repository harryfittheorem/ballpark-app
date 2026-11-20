-- Manual location limits were approved as the initial capacity model.
-- No capacity numbers, resource inventory or instructor-correction roles are seeded.
BEGIN;

CREATE TABLE public.scheduling_capacity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  previous_lesson_capacity integer,
  previous_rental_capacity integer,
  lesson_capacity integer NOT NULL,
  rental_capacity integer NOT NULL
);
ALTER TABLE public.scheduling_capacity_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY capacity_history_read ON public.scheduling_capacity_history
  FOR SELECT TO authenticated USING (public.can_manage_booking_location(tenant_id, location_id));
GRANT SELECT ON public.scheduling_capacity_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.scheduling_capacity_history FROM authenticated, anon;
GRANT ALL ON public.scheduling_capacity_history TO service_role;

-- Configuration is restricted to existing tenant owners. This does not grant
-- admins/coaches new policy-setting powers or approve correction permissions.
CREATE FUNCTION public.set_manual_location_capacity(
  p_location_id uuid, p_lesson_capacity integer, p_rental_capacity integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_previous public.scheduling_location_rules%ROWTYPE;
  v_lesson_peak bigint;
  v_rental_peak bigint;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','super_admin')
    OR NOT COALESCE(public.can_manage_booking_location(v_tenant,p_location_id),false) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF p_lesson_capacity IS NULL OR p_rental_capacity IS NULL
    OR p_lesson_capacity <= 0 OR p_rental_capacity <= 0 THEN
    RAISE EXCEPTION 'positive_capacity_required';
  END IF;
  -- Serialize configuration with all reservations, including legacy clients.
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT * INTO v_previous FROM public.scheduling_location_rules
    WHERE location_id=p_location_id AND tenant_id=v_tenant FOR UPDATE;

  -- Refuse a reduction that would put an existing future booking over the
  -- limit. Group endpoints before the running sum so back-to-back sessions
  -- do not falsely overlap. No existing booking is cancelled or altered.
  WITH reservations AS (
    SELECT st.type_category='cage' AS rental,
      greatest(b.scheduled_start,now()) AS starts, b.scheduled_end AS ends
    FROM public.bookings b JOIN public.session_types st ON st.id=b.session_type_id
    WHERE b.tenant_id=v_tenant AND b.location_id=p_location_id
      AND b.status NOT IN ('cancelled','no_show') AND b.scheduled_end>now()
  ), endpoints AS (
    SELECT rental,starts AS moment,1 AS delta FROM reservations
    UNION ALL SELECT rental,ends,-1 FROM reservations
  ), changes AS (
    SELECT rental,moment,sum(delta) AS delta FROM endpoints GROUP BY rental,moment
  ), occupancy AS (
    SELECT rental,sum(delta) OVER (PARTITION BY rental ORDER BY moment) AS occupied FROM changes
  )
  SELECT COALESCE(max(occupied) FILTER (WHERE NOT rental),0),
         COALESCE(max(occupied) FILTER (WHERE rental),0)
    INTO v_lesson_peak,v_rental_peak FROM occupancy;
  IF v_lesson_peak>p_lesson_capacity OR v_rental_peak>p_rental_capacity THEN
    RAISE EXCEPTION 'capacity_below_existing_reservations';
  END IF;
  INSERT INTO public.scheduling_location_rules
    (tenant_id,location_id,lesson_capacity,rental_capacity,capacity_source,approved_by,approved_at)
    VALUES(v_tenant,p_location_id,p_lesson_capacity,p_rental_capacity,'manual',auth.uid(),now())
    ON CONFLICT (location_id) DO UPDATE SET
      lesson_capacity=EXCLUDED.lesson_capacity,rental_capacity=EXCLUDED.rental_capacity,
      capacity_source='manual',approved_by=EXCLUDED.approved_by,approved_at=EXCLUDED.approved_at;
  INSERT INTO public.scheduling_capacity_history
    (tenant_id,location_id,actor_id,previous_lesson_capacity,previous_rental_capacity,lesson_capacity,rental_capacity)
    VALUES(v_tenant,p_location_id,auth.uid(),v_previous.lesson_capacity,v_previous.rental_capacity,
      p_lesson_capacity,p_rental_capacity);
END;
$$;
REVOKE ALL ON FUNCTION public.set_manual_location_capacity(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_manual_location_capacity(uuid,integer,integer) TO authenticated;
COMMIT;
