-- =============================================================================
-- Re-apply service-role bypass to check-in RPCs (after staff-coach rewrite).
--
-- Migration 20260605000001_staff_coach_db_access.sql re-wrote all three
-- check-in RPCs to add staff-coach/instructor-coach branching but accidentally
-- dropped the service-role JWT bypass that was introduced by
-- 20260603000000_fix_checkin_rpcs_owner_role.sql.
--
-- The portal server actions call these RPCs via createServiceClient(), whose
-- JWT carries { "role": "service_role" } with no "app_role" claim. Without the
-- bypass, auth.jwt() ->> 'app_role' is NULL → role gate fires → PERMISSION_DENIED.
--
-- This migration reinstates the bypass on all three RPCs while preserving the
-- full staff-coach vs. instructor-coach access-control logic.
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
  v_role         text;
  v_tenant_id    uuid;
  v_coach_id     uuid;
  v_coach_preset text;
  v_booking      public.bookings%ROWTYPE;
  v_service_role boolean := false;
BEGIN
  -- ── Service-role short-circuit ─────────────────────────────────────────
  -- Portal server actions call via the service-role key. When the JWT carries
  -- role = 'service_role' there is no app_role claim; skip all JWT-based
  -- role/tenant checks. Tenant isolation is still enforced via the booking
  -- row's own tenant_id column.
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    v_service_role := true;
  END IF;

  -- ── Role gate (parent / anon denied) ──────────────────────────────────
  IF NOT v_service_role THEN
    v_role := auth.jwt() ->> 'app_role';
    IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Lock row ───────────────────────────────────────────────────────────
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── Tenant isolation + role-specific access control ───────────────────
  IF NOT v_service_role THEN
    v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

    IF v_role = 'coach' THEN
      SELECT id, capabilities->>'preset'
        INTO v_coach_id, v_coach_preset
        FROM public.coaches
       WHERE user_id = auth.uid()
         AND tenant_id = v_tenant_id;

      -- Instructor coaches may only act on their own assigned bookings.
      -- Staff coaches have facility-wide check-in authority.
      IF v_coach_preset IS DISTINCT FROM 'staff' THEN
        IF v_booking.coach_id IS DISTINCT FROM v_coach_id THEN
          RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
        END IF;
      END IF;

    ELSIF v_role = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_locations sl
         WHERE sl.user_id     = auth.uid()
           AND sl.location_id = v_booking.location_id
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;

    -- owner + super_admin: tenant-wide access, no additional restriction
    END IF;
  END IF;

  -- ── Idempotent: already completed → return current row ─────────────────
  IF v_booking.status = 'completed' THEN
    RETURN row_to_json(v_booking);
  END IF;

  -- ── Only pending/confirmed may be checked in ────────────────────────────
  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: booking is %', v_booking.status
      USING ERRCODE = 'P0003';
  END IF;

  -- ── Mark completed (fires award_booking_completion_points trigger) ───────
  UPDATE public.bookings
     SET status      = 'completed',
         attended_at = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  -- ── Create sessions row if one doesn't exist for this booking ───────────
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
  v_role         text;
  v_tenant_id    uuid;
  v_coach_id     uuid;
  v_coach_preset text;
  v_booking      public.bookings%ROWTYPE;
  v_service_role boolean := false;
BEGIN
  -- ── Service-role short-circuit ─────────────────────────────────────────
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    v_service_role := true;
  END IF;

  -- ── Role gate ─────────────────────────────────────────────────────────
  IF NOT v_service_role THEN
    v_role := auth.jwt() ->> 'app_role';
    IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Lock row ─────────────────────────────────────────────────────────
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── Tenant isolation + role-specific access control ───────────────────
  IF NOT v_service_role THEN
    v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

    IF v_role = 'coach' THEN
      SELECT id, capabilities->>'preset'
        INTO v_coach_id, v_coach_preset
        FROM public.coaches
       WHERE user_id = auth.uid()
         AND tenant_id = v_tenant_id;

      IF v_coach_preset IS DISTINCT FROM 'staff' THEN
        IF v_booking.coach_id IS DISTINCT FROM v_coach_id THEN
          RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
        END IF;
      END IF;

    ELSIF v_role = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_locations sl
         WHERE sl.user_id     = auth.uid()
           AND sl.location_id = v_booking.location_id
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;

    -- owner + super_admin: tenant-wide, no location restriction
    END IF;
  END IF;

  -- ── Idempotent ────────────────────────────────────────────────────────
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
  v_role         text;
  v_tenant_id    uuid;
  v_coach_id     uuid;
  v_coach_preset text;
  v_booking      public.bookings%ROWTYPE;
  v_delta        int;
  v_service_role boolean := false;
BEGIN
  -- ── Service-role short-circuit ─────────────────────────────────────────
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    v_service_role := true;
  END IF;

  -- ── Role gate ─────────────────────────────────────────────────────────
  IF NOT v_service_role THEN
    v_role := auth.jwt() ->> 'app_role';
    IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Lock row ─────────────────────────────────────────────────────────
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── Tenant isolation + role-specific access control ───────────────────
  IF NOT v_service_role THEN
    v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

    IF v_role = 'coach' THEN
      SELECT id, capabilities->>'preset'
        INTO v_coach_id, v_coach_preset
        FROM public.coaches
       WHERE user_id = auth.uid()
         AND tenant_id = v_tenant_id;

      IF v_coach_preset IS DISTINCT FROM 'staff' THEN
        IF v_booking.coach_id IS DISTINCT FROM v_coach_id THEN
          RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
        END IF;
      END IF;

    ELSIF v_role = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_locations sl
         WHERE sl.user_id     = auth.uid()
           AND sl.location_id = v_booking.location_id
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
      END IF;

    -- owner + super_admin: tenant-wide, no location restriction
    END IF;
  END IF;

  -- ── Booking must be completed to undo ────────────────────────────────
  IF v_booking.status != 'completed' THEN
    RAISE EXCEPTION 'NOT_CHECKED_IN: booking status is %', v_booking.status
      USING ERRCODE = 'P0004';
  END IF;

  -- ── 5-minute undo window ─────────────────────────────────────────────
  IF v_booking.attended_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'UNDO_WINDOW_EXPIRED'
      USING ERRCODE = 'P0005';
  END IF;

  -- ── Revert booking (award trigger only fires on → 'completed', so this
  --    UPDATE does NOT re-trigger points) ──────────────────────────────
  UPDATE public.bookings
     SET status      = 'confirmed',
         attended_at = NULL
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  -- ── Delete the sessions row created by check_in_booking ─────────────
  DELETE FROM public.sessions WHERE booking_id = p_booking_id;

  -- ── Reverse points: remove ledger row and decrement kid balance ───────
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
