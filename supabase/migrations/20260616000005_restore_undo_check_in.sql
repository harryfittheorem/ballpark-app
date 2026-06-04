-- =============================================================================
-- Restore undo_check_in to the definitive version.
--
-- 20260616000001_fix_checkin_rpcs_service_role_bypass.sql (applied just before
-- this) rewrites undo_check_in with service-role bypass but without support for
-- the 'weekly_visit_bonus' ledger reason introduced by
-- 20260607000000_gamification_points_rules.sql §5.
--
-- Because gamification_points_rules was applied to production before the
-- service-role-bypass migration (due to the duplicate-timestamp ordering
-- anomaly), the §5 version in gamification_points_rules is the authoritative
-- one and needs to be re-applied here to preserve both:
--   • service-role bypass           (portal server actions)
--   • staff-coach preset branching  (instructor vs. staff coaches)
--   • weekly_visit_bonus support    (new bookings use this ledger reason)
-- =============================================================================

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

  -- ── Fetch + lock the booking ──────────────────────────────────────────
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── Tenant check ─────────────────────────────────────────────────────
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

    -- owner + super_admin: tenant-wide access, no additional restriction
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

  -- ── Revert booking ────────────────────────────────────────────────────
  UPDATE public.bookings
     SET status      = 'confirmed',
         attended_at = NULL
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  -- ── Delete the sessions row created by check_in_booking ──────────────
  DELETE FROM public.sessions WHERE booking_id = p_booking_id;

  -- ── Reverse points: support both old ('session_attended') and new
  --    ('weekly_visit_bonus') ledger reasons so the undo works regardless
  --    of when the booking was originally checked in. ──────────────────
  SELECT delta INTO v_delta
    FROM public.points_ledger
   WHERE kid_id         = v_booking.kid_id
     AND reference_type = 'booking'
     AND reference_id   = p_booking_id
     AND reason         IN ('weekly_visit_bonus', 'session_attended');

  IF FOUND AND v_delta IS NOT NULL THEN
    DELETE FROM public.points_ledger
     WHERE kid_id         = v_booking.kid_id
       AND reference_type = 'booking'
       AND reference_id   = p_booking_id
       AND reason         IN ('weekly_visit_bonus', 'session_attended');

    UPDATE public.kids
       SET points_balance = GREATEST(0, points_balance - v_delta)
     WHERE id = v_booking.kid_id;
  END IF;

  RETURN row_to_json(v_booking);
END;
$$;

ALTER FUNCTION public.undo_check_in(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.undo_check_in(uuid) TO authenticated, service_role;
