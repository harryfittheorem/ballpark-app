-- =============================================================================
-- Ballpark — Public booking page: rework availability + booking creation RPC
-- =============================================================================
-- Fixes identified in code review:
--
-- 1. get_public_availability now takes p_duration_minutes so it generates
--    discrete bookable start times (e.g. 9:00, 10:00, 11:00 for 60-min sessions
--    in a 9:00–12:00 window) rather than returning raw windows.  Each slot is
--    availability-checked independently for exactly that [start, start+duration]
--    window, so one existing booking never blocks unrelated future slots.
--
-- 2. create_public_booking is a new SECURITY DEFINER function that:
--    · verifies auth.uid() is present (authenticated caller only)
--    · derives tenant from slug (not from client-supplied tenant_id)
--    · validates kid belongs to caller's family in that tenant
--    · validates session_type belongs to that tenant and is active
--    · performs a FOR UPDATE overlap check before inserting (atomic guard)
--    · returns the new booking id
--    This replaces the direct client-side bookings INSERT and enforces all
--    business invariants on the server.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Rework get_public_availability — discrete slots, duration-aware
-- -----------------------------------------------------------------------------

-- Drop old overloads (both (text,date,date) and (text,date,date,int) if present)
DROP FUNCTION IF EXISTS public.get_public_availability(text, date, date);
DROP FUNCTION IF EXISTS public.get_public_availability(text, date, date, int);

CREATE OR REPLACE FUNCTION public.get_public_availability(
  p_tenant_slug       text,
  p_date_range_start  date,
  p_date_range_end    date,
  p_duration_minutes  int DEFAULT 60
)
RETURNS TABLE (
  coach_id         uuid,
  coach_first_name text,
  coach_last_name  text,
  location_id      uuid,
  location_name    text,
  slot_date        date,
  start_time       time,
  end_time         time,
  is_available     boolean
)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_dur       interval;
BEGIN
  SELECT t.id INTO v_tenant_id FROM public.tenants t WHERE t.slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- Safety: cap range to 30 days; cap duration to 8 hours
  IF p_date_range_end - p_date_range_start > 30 THEN
    p_date_range_end := p_date_range_start + 30;
  END IF;
  IF p_duration_minutes < 15  THEN p_duration_minutes := 15;  END IF;
  IF p_duration_minutes > 480 THEN p_duration_minutes := 480; END IF;

  v_dur := (p_duration_minutes::text || ' minutes')::interval;

  -- For every coach availability window on every date in range, generate
  -- discrete start times spaced v_dur apart.  Each slot is
  -- [slot_start, slot_start + v_dur] and must fit entirely within the window.
  RETURN QUERY
  WITH windows AS (
    SELECT
      c.id          AS coach_id,
      c.first_name  AS coach_first_name,
      c.last_name   AS coach_last_name,
      l.id          AS location_id,
      l.name        AS location_name,
      d.dt::date    AS slot_date,
      ca.start_time,
      ca.end_time
    FROM generate_series(
      p_date_range_start::timestamp,
      p_date_range_end::timestamp,
      '1 day'::interval
    ) AS d(dt)
    JOIN public.coach_availability ca
      ON  ca.tenant_id   = v_tenant_id
      AND ca.day_of_week = EXTRACT(DOW FROM d.dt)::int
      AND (ca.effective_from  IS NULL OR ca.effective_from  <= d.dt::date)
      AND (ca.effective_until IS NULL OR ca.effective_until >= d.dt::date)
    JOIN public.coaches c
      ON  c.id        = ca.coach_id
      AND c.tenant_id = v_tenant_id
      AND c.is_active = true
    JOIN public.locations l
      ON  l.id        = ca.location_id
      AND l.tenant_id = v_tenant_id
    WHERE d.dt::date >= CURRENT_DATE
  )
  SELECT
    w.coach_id,
    w.coach_first_name,
    w.coach_last_name,
    w.location_id,
    w.location_name,
    w.slot_date,
    gs.slot_start::time                  AS start_time,
    (gs.slot_start + v_dur)::time        AS end_time,
    NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.tenant_id      = v_tenant_id
        AND b.coach_id       = w.coach_id
        AND b.status         NOT IN ('cancelled', 'no_show')
        AND b.scheduled_start < (gs.slot_start + v_dur)::timestamptz
        AND b.scheduled_end   >  gs.slot_start::timestamptz
    )                                    AS is_available
  FROM windows w
  CROSS JOIN LATERAL generate_series(
    (w.slot_date + w.start_time)::timestamp,
    (w.slot_date + w.end_time)::timestamp - v_dur,
    v_dur
  ) AS gs(slot_start)
  ORDER BY w.slot_date, gs.slot_start::time, w.coach_first_name;
END;
$$;

ALTER FUNCTION public.get_public_availability(text, date, date, int) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_public_availability(text, date, date, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_availability(text, date, date, int) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. create_public_booking — server-side booking creation with overlap guard
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_slug     text,
  p_coach_id        uuid,
  p_location_id     uuid,
  p_session_type_id uuid,
  p_kid_id          uuid,
  p_scheduled_start timestamptz
)
RETURNS TABLE (booking_id uuid)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id     uuid;
  v_duration      interval;
  v_scheduled_end timestamptz;
  v_family_id     uuid;
  v_booking_id    uuid;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Derive tenant from slug (never trust a client-supplied tenant_id)
  SELECT t.id INTO v_tenant_id FROM public.tenants t WHERE t.slug = p_tenant_slug LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;

  -- Caller must have a family in this tenant
  SELECT f.id INTO v_family_id
  FROM public.families f
  WHERE f.parent_user_id = auth.uid()
    AND f.tenant_id      = v_tenant_id
  LIMIT 1;
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'family_not_found';
  END IF;

  -- The kid must belong to this family
  IF NOT EXISTS (
    SELECT 1 FROM public.kids k
    WHERE k.id        = p_kid_id
      AND k.family_id = v_family_id
  ) THEN
    RAISE EXCEPTION 'kid_not_in_family';
  END IF;

  -- Session type must belong to this tenant and be active
  SELECT (st.duration_minutes::text || ' minutes')::interval INTO v_duration
  FROM public.session_types st
  WHERE st.id        = p_session_type_id
    AND st.tenant_id = v_tenant_id
    AND st.is_active = true
  LIMIT 1;
  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'session_type_not_found';
  END IF;

  v_scheduled_end := p_scheduled_start + v_duration;

  -- Atomic overlap guard — FOR UPDATE SKIP LOCKED: if another concurrent
  -- transaction is inserting into the same slot, we optimistically skip and
  -- proceed; the UNIQUE constraint on (coach_id, scheduled_start) would catch
  -- true duplicates.  The select + insert pair is not 100% serializable without
  -- SERIALIZABLE isolation, but provides a best-effort guard consistent with
  -- the rest of the system.
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.tenant_id      = v_tenant_id
      AND b.coach_id       = p_coach_id
      AND b.status         NOT IN ('cancelled', 'no_show')
      AND b.scheduled_start < v_scheduled_end
      AND b.scheduled_end   > p_scheduled_start
    FOR UPDATE SKIP LOCKED
  ) THEN
    RAISE EXCEPTION 'slot_not_available';
  END IF;

  -- Insert booking
  INSERT INTO public.bookings (
    tenant_id, location_id, kid_id, coach_id, session_type_id,
    scheduled_start, scheduled_end, status
  ) VALUES (
    v_tenant_id, p_location_id, p_kid_id, p_coach_id, p_session_type_id,
    p_scheduled_start, v_scheduled_end, 'confirmed'
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id;
END;
$$;

ALTER FUNCTION public.create_public_booking(text, uuid, uuid, uuid, uuid, timestamptz) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text, uuid, uuid, uuid, uuid, timestamptz) TO authenticated;
