-- =============================================================================
-- Ballpark — Staff-coach DB access: tenant-wide booking reads + check-in ops
-- =============================================================================
-- Addresses two gaps left after 20260605000000_coach_capabilities:
--
--   A) bookings SELECT RLS — instructor coaches can only see their own assigned
--      bookings (bookings_select_coach policy). Staff coaches need a tenant-wide
--      view so the /coach/schedule and /coach/check-in pages show the full
--      facility board.
--
--   B) Check-in RPCs enforce "coach may only act on bookings assigned to them".
--      Staff coaches need to check in any booking in the tenant, not just theirs.
--
--   C) mark_redemption_fulfilled_staff(p_code) — DB-enforced SECURITY DEFINER
--      RPC that validates app_role='coach' AND capabilities->>'preset'='staff'
--      at the DB layer, so the portal route never needs service-role for redemptions.
--
-- Depends on:
--   20260605000000_coach_capabilities.sql  (coaches.capabilities column)
--   20260602000000_check_in_rpcs.sql       (three check-in RPCs)
--   20260511000000_v07_achievements_and_fulfillment.sql (orders / redemption_code)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. Helper: get_my_coach_preset()
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it bypasses coaches RLS when invoked inside a bookings
-- SELECT policy. This prevents infinite RLS recursion:
--   bookings policy → subquery coaches → coaches policy → subquery bookings
-- Returns NULL when the calling user has no coaches row (e.g. admin, parent).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_coach_preset()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT capabilities->>'preset'
    FROM public.coaches
   WHERE user_id = auth.uid()
   LIMIT 1;
$$;

ALTER FUNCTION public.get_my_coach_preset() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_my_coach_preset() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_coach_preset() TO authenticated;


-- ---------------------------------------------------------------------------
-- A. Booking SELECT policy for staff coaches (tenant-wide)
-- ---------------------------------------------------------------------------
-- Staff coaches see ALL bookings in their tenant (floor-ops view).
-- Instructor coaches continue to use bookings_select_coach (own bookings only).
-- The SECURITY DEFINER helper avoids RLS recursion on the coaches table.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS bookings_select_staff_coach ON public.bookings;
CREATE POLICY bookings_select_staff_coach ON public.bookings
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'coach'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND public.get_my_coach_preset() = 'staff'
  );


-- ---------------------------------------------------------------------------
-- B. Update check-in RPCs — staff coaches act on any booking in their tenant
-- ---------------------------------------------------------------------------
-- Each of the three RPCs has the same coach block:
--   "Coach may only act on bookings assigned to them"
-- We replace that block with:
--   - IF coach is staff → tenant-wide (skip coach_id match)
--   - IF coach is instructor → original own-booking restriction
-- ---------------------------------------------------------------------------


-- ── check_in_booking ───────────────────────────────────────────────────────

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
  v_coach_preset text;
  v_booking     public.bookings%ROWTYPE;
BEGIN
  -- ── Role gate (parent denied) ──────────────────────────────────────────
  v_role := auth.jwt() ->> 'app_role';
  IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Lock row ───────────────────────────────────────────────────────────
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── Tenant isolation ───────────────────────────────────────────────────
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Role-specific access control ───────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;


-- ── mark_no_show ───────────────────────────────────────────────────────────

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
  v_coach_preset text;
  v_booking     public.bookings%ROWTYPE;
BEGIN
  -- ── Role gate ─────────────────────────────────────────────────────────
  v_role := auth.jwt() ->> 'app_role';
  IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Lock row ─────────────────────────────────────────────────────────
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── Tenant isolation ─────────────────────────────────────────────────
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Role-specific access control ─────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION public.mark_no_show(uuid) TO authenticated;


-- ── undo_check_in ──────────────────────────────────────────────────────────

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
  v_coach_preset text;
  v_booking     public.bookings%ROWTYPE;
  v_delta       int;
BEGIN
  -- ── Role gate ─────────────────────────────────────────────────────────
  v_role := auth.jwt() ->> 'app_role';
  IF v_role NOT IN ('admin', 'coach', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Lock row ─────────────────────────────────────────────────────────
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── Tenant isolation ─────────────────────────────────────────────────
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_booking.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Role-specific access control ─────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION public.undo_check_in(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- C. mark_redemption_fulfilled_staff(p_code text)
-- ---------------------------------------------------------------------------
-- DB-enforced SECURITY DEFINER RPC for staff coaches to fulfill point
-- redemptions. Enforces at the DB layer:
--   • app_role must be 'coach'
--   • caller's coaches row must have capabilities->>'preset' = 'staff'
--   • order's tenant_id must match caller's tenant_id
--   • same business guards as mark_redemption_fulfilled (admin version):
--     payment_method = 'points', status = 'ordered'
-- Identical fulfillment logic (idempotent, FOR UPDATE lock, status + timestamps).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_redemption_fulfilled_staff(p_code text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role       text;
  v_tenant_id  uuid;
  v_user_id    uuid;
  v_order      public.orders%ROWTYPE;
BEGIN
  -- ── Role gate: must be a coach ─────────────────────────────────────────
  v_role := auth.jwt() ->> 'app_role';
  IF v_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled_staff: caller is not a coach'
      USING ERRCODE = '42501';
  END IF;

  v_user_id   := auth.uid();
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;

  -- ── Preset gate: must be staff ────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.coaches
     WHERE user_id    = v_user_id
       AND tenant_id  = v_tenant_id
       AND capabilities->>'preset' = 'staff'
  ) THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled_staff: caller is not a staff coach'
      USING ERRCODE = '42501';
  END IF;

  -- ── Resolve code → order (FOR UPDATE to serialize concurrent taps) ────
  SELECT o.* INTO v_order
    FROM public.orders o
   WHERE o.redemption_code = upper(trim(p_code))
     AND o.tenant_id       = v_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled_staff: redemption code % not found in tenant',
      p_code
      USING ERRCODE = 'P0002';
  END IF;

  -- ── Idempotent re-tap ─────────────────────────────────────────────────
  IF v_order.fulfilled_at IS NOT NULL THEN
    RETURN v_order;
  END IF;

  -- ── Business guards ───────────────────────────────────────────────────
  IF v_order.payment_method <> 'points' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled_staff: order % is %, only points redemptions can be fulfilled here',
      v_order.id, v_order.payment_method
      USING ERRCODE = 'P0001';
  END IF;
  IF v_order.status <> 'ordered' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled_staff: order % status is %, expected ordered',
      v_order.id, v_order.status
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Fulfill ───────────────────────────────────────────────────────────
  UPDATE public.orders
     SET status               = 'fulfilled',
         fulfilled_at         = now(),
         fulfilled_by_user_id = v_user_id
   WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

ALTER FUNCTION public.mark_redemption_fulfilled_staff(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.mark_redemption_fulfilled_staff(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mark_redemption_fulfilled_staff(text) TO authenticated;
