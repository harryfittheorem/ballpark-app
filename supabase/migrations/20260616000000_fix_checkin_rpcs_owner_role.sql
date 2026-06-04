-- =============================================================================
-- Re-apply service-role bypass to check-in RPCs.
--
-- Migration 20260602000000_check_in_rpcs.sql introduced the final check-in RPC
-- definitions but did so WITHOUT the service-role bypass that was added in
-- 20260525000002_fix_checkin_rpcs_service_role.sql. Because migrations run in
-- timestamp order, the later migration overwrote the fix.
--
-- This migration re-instates the bypass: when the caller's JWT carries
-- { "role": "service_role" } (the portal's server actions use the service-role
-- key), all JWT-based role/tenant checks are skipped. Tenant isolation is still
-- enforced via the booking row's own tenant_id column. The portal server action
-- has already verified the caller's identity via supabase.auth.getUser() and
-- the app_metadata/user_metadata role fallbacks before invoking the service
-- client.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- check_in_booking
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_in_booking(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role        text;
  v_tenant_id   uuid;
  v_coach_id    uuid;
  v_booking     public.bookings%ROWTYPE;
  v_service_role boolean := false;
BEGIN
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    v_service_role := true;
  END IF;

  IF NOT v_service_role THEN
    v_role := auth.jwt() ->> 'app_role';
    IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_service_role THEN
    v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

    IF v_role = 'coach' THEN
      SELECT id INTO v_coach_id
        FROM public.coaches
       WHERE user_id = auth.uid()
         AND tenant_id = v_tenant_id;
      IF v_booking.coach_id IS DISTINCT FROM v_coach_id THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;

    ELSIF v_role = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_locations sl
         WHERE sl.user_id     = auth.uid()
           AND sl.location_id = v_booking.location_id
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  IF v_booking.status = 'completed' THEN
    RETURN row_to_json(v_booking);
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: booking is %', v_booking.status
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.bookings
     SET status      = 'completed',
         attended_at = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  IF NOT EXISTS (
    SELECT 1 FROM public.sessions WHERE booking_id = p_booking_id
  ) THEN
    INSERT INTO public.sessions (
      tenant_id, kid_id, coach_id, booking_id,
      capture_source, started_at, ended_at
    ) VALUES (
      v_booking.tenant_id, v_booking.kid_id, v_booking.coach_id, p_booking_id,
      'none', v_booking.scheduled_start, v_booking.scheduled_end
    );
  END IF;

  RETURN row_to_json(v_booking);
END;
$$;

ALTER FUNCTION public.check_in_booking(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- mark_no_show
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_no_show(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role        text;
  v_tenant_id   uuid;
  v_coach_id    uuid;
  v_booking     public.bookings%ROWTYPE;
  v_service_role boolean := false;
BEGIN
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    v_service_role := true;
  END IF;

  IF NOT v_service_role THEN
    v_role := auth.jwt() ->> 'app_role';
    IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_service_role THEN
    v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

    IF v_role = 'coach' THEN
      SELECT id INTO v_coach_id
        FROM public.coaches
       WHERE user_id = auth.uid()
         AND tenant_id = v_tenant_id;
      IF v_booking.coach_id IS DISTINCT FROM v_coach_id THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;

    ELSIF v_role = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_locations sl
         WHERE sl.user_id     = auth.uid()
           AND sl.location_id = v_booking.location_id
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  IF v_booking.status = 'no_show' THEN
    RETURN row_to_json(v_booking);
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: booking is %', v_booking.status
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.bookings
     SET status      = 'no_show',
         attended_at = NULL
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN row_to_json(v_booking);
END;
$$;

ALTER FUNCTION public.mark_no_show(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.mark_no_show(uuid) TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- undo_check_in
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.undo_check_in(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role        text;
  v_tenant_id   uuid;
  v_coach_id    uuid;
  v_booking     public.bookings%ROWTYPE;
  v_delta       int;
  v_service_role boolean := false;
BEGIN
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    v_service_role := true;
  END IF;

  IF NOT v_service_role THEN
    v_role := auth.jwt() ->> 'app_role';
    IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_service_role THEN
    v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

    IF v_role = 'coach' THEN
      SELECT id INTO v_coach_id
        FROM public.coaches
       WHERE user_id = auth.uid()
         AND tenant_id = v_tenant_id;
      IF v_booking.coach_id IS DISTINCT FROM v_coach_id THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;

    ELSIF v_role = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_locations sl
         WHERE sl.user_id     = auth.uid()
           AND sl.location_id = v_booking.location_id
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  IF v_booking.status != 'completed' THEN
    RAISE EXCEPTION 'NOT_CHECKED_IN: booking status is %', v_booking.status
      USING ERRCODE = 'P0004';
  END IF;

  IF v_booking.attended_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'UNDO_WINDOW_EXPIRED'
      USING ERRCODE = 'P0005';
  END IF;

  UPDATE public.bookings
     SET status      = 'confirmed',
         attended_at = NULL
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  DELETE FROM public.sessions WHERE booking_id = p_booking_id;

  SELECT delta INTO v_delta
    FROM public.points_ledger
   WHERE kid_id         = v_booking.kid_id
     AND reference_type = 'booking'
     AND reference_id   = p_booking_id
     AND reason         = 'session_attended';

  IF FOUND AND v_delta IS NOT NULL THEN
    DELETE FROM public.points_ledger
     WHERE kid_id         = v_booking.kid_id
       AND reference_type = 'booking'
       AND reference_id   = p_booking_id
       AND reason         = 'session_attended';

    UPDATE public.kids
       SET points_balance = GREATEST(0, points_balance - v_delta)
     WHERE id = v_booking.kid_id;
  END IF;

  RETURN row_to_json(v_booking);
END;
$$;

ALTER FUNCTION public.undo_check_in(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.undo_check_in(uuid) TO authenticated, service_role;
