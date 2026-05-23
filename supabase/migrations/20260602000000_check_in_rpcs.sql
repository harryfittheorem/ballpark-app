-- =============================================================================
-- Ballpark — Check-in RPCs + schema additions
-- =============================================================================
-- Depends on: 20260601000000_phase2_staff_locations.sql (staff_locations table)
--             20260601000003_phase2_admin_rls_staff_locations.sql (admin booking SELECT)
--
-- 1. Add booking_id + coach_id columns to sessions (nullable; used when a
--    booking is checked in without a HitTrax/capture source).
-- 2. Add admin/coach UPDATE policies on bookings so direct Supabase client
--    calls (outside of SECURITY DEFINER RPCs) are also appropriately scoped.
--    The RPC path enforces the same checks in-function (see below).
-- 3. Three SECURITY DEFINER RPCs. Role gate and location scoping:
--
--    Role          Location scope
--    -----------   -----------------------------------------------
--    coach         Only bookings assigned to their own coach row
--    admin         Only bookings whose location_id is in their staff_locations
--    owner         Tenant-wide (owns the whole facility)
--    super_admin   Tenant-wide (platform operator, no location restriction)
--    parent        DENIED — check-in is staff-only
--
--    Because SECURITY DEFINER bypasses RLS, all location/ownership checks
--    are re-enforced explicitly inside each function body.
--
--      check_in_booking(uuid)   — marks attended, creates session row, fires points trigger
--      mark_no_show(uuid)       — sets status='no_show', clears attended_at
--      undo_check_in(uuid)      — reverts within 5 minutes, deletes session row + points
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extend sessions table with booking linkage
-- -----------------------------------------------------------------------------

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coach_id   uuid REFERENCES public.coaches(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_booking_id ON public.sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach_id   ON public.sessions(coach_id);


-- -----------------------------------------------------------------------------
-- 2. Admin + coach UPDATE policy on bookings
-- -----------------------------------------------------------------------------

CREATE POLICY bookings_admin_update_staff_locations ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND location_id IN (
      SELECT sl.location_id FROM public.staff_locations sl WHERE sl.user_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND location_id IN (
      SELECT sl.location_id FROM public.staff_locations sl WHERE sl.user_id = auth.uid()
    )
  );

CREATE POLICY bookings_coach_update_own ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'coach'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND coach_id IN (
      SELECT id FROM public.coaches WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') = 'coach'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND coach_id IN (
      SELECT id FROM public.coaches WHERE user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- Helper macro (inline in each RPC): enforce_checkin_access
-- Rather than a shared helper function, the identical check is inlined so each
-- RPC's access control is self-contained and auditable in isolation.
--
-- Logic (applied after tenant check, before status mutation):
--   coach      → must own the booking (coach_id matches their coaches row)
--   admin      → booking's location_id must be in their staff_locations rows
--   owner      → tenant-wide (no extra restriction)
--   super_admin→ unrestricted (platform operator)
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- 3a. check_in_booking(p_booking_id)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_in_booking(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role       text;
  v_tenant_id  uuid;
  v_coach_id   uuid;
  v_booking    public.bookings%ROWTYPE;
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
    -- Coach may only act on bookings assigned to them
    SELECT id INTO v_coach_id
      FROM public.coaches
     WHERE user_id = auth.uid()
       AND tenant_id = v_tenant_id;
    IF v_booking.coach_id IS DISTINCT FROM v_coach_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

  ELSIF v_role = 'admin' THEN
    -- Admin is location-scoped: booking's location must be in their staff_locations
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_locations sl
       WHERE sl.user_id     = auth.uid()
         AND sl.location_id = v_booking.location_id
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = 'P0001';
    END IF;

  -- owner + super_admin: tenant-wide access, no additional location restriction
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


-- -----------------------------------------------------------------------------
-- 3b. mark_no_show(p_booking_id)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_no_show(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role      text;
  v_tenant_id uuid;
  v_coach_id  uuid;
  v_booking   public.bookings%ROWTYPE;
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


-- -----------------------------------------------------------------------------
-- 3c. undo_check_in(p_booking_id)
-- -----------------------------------------------------------------------------
-- Reverts a completed booking back to confirmed within a 5-minute window.
-- Also deletes the sessions row and reverses the points award.
-- Raises UNDO_WINDOW_EXPIRED if called after 5 minutes.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.undo_check_in(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role      text;
  v_tenant_id uuid;
  v_coach_id  uuid;
  v_booking   public.bookings%ROWTYPE;
  v_delta     int;
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
   WHERE kid_id        = v_booking.kid_id
     AND reference_type = 'booking'
     AND reference_id   = p_booking_id
     AND reason         = 'session_attended';

  IF FOUND AND v_delta IS NOT NULL THEN
    DELETE FROM public.points_ledger
     WHERE kid_id        = v_booking.kid_id
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
