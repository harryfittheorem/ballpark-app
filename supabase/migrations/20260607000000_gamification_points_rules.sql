-- =============================================================================
-- Ballpark — Gamification points rules update
-- =============================================================================
-- Three changes:
--
--   1. Documents why launch_angle_deg and spray_angle_deg are excluded from
--      detect_swing_pr() — no code change needed; confirmation comment only.
--
--   2. Adds tenant_settings(tenant_id, key, value) — an operator-editable
--      key/value table. Seeds bring_a_friend_points = '100' for infinitehitting.
--
--   3. Replaces the flat +10 award_booking_completion_points() trigger with
--      a tiered weekly-visit bonus:
--        1st visit of ISO week → +2 pts
--        2nd visit             → +3 pts
--        3rd+ visit            → +5 pts per visit
--      Reason changes from 'session_attended' → 'weekly_visit_bonus'.
--      Idempotency preserved via partial unique index on reference_id.
--      The old trigger is dropped; old index and function are kept for any
--      existing ledger rows that used reason='session_attended'.
--
--   4. Updates book_session_with_friend() to read the bonus amount from
--      tenant_settings where key = 'bring_a_friend_points', falling back to 100.
-- =============================================================================


-- =============================================================================
-- §1  PR TRIGGER AUDIT COMMENT
-- =============================================================================
-- detect_swing_pr() (migration 20260508060000) covers exactly three metrics:
--
--   exit_velocity_mph  — higher is unambiguously better; tracked as PR.
--   distance_ft        — higher is unambiguously better; tracked as PR.
--   pitch_speed_mph    — higher is unambiguously better; tracked as PR.
--
-- Two metrics are intentionally excluded:
--
--   launch_angle_deg   — directionally ambiguous. The "ideal" launch angle
--                        depends on the pitch location, batted-ball intent, and
--                        hitter profile. A higher number is not always better
--                        (pop-up vs. line-drive vs. ground-ball), so there is
--                        no meaningful "personal best" to track.
--
--   spray_angle_deg    — directionally ambiguous. Pull, center, and opposite-
--                        field results all have context-dependent value.
--                        Tracking a PR for "most pull-side" or "most oppo" is
--                        not a meaningful athletic achievement.
--
-- The personal_bests table's metric CHECK constraint also enforces these
-- exclusions at the DB level. No code change is required.
-- =============================================================================


-- =============================================================================
-- §1b  Extend points_ledger reason CHECK
-- =============================================================================
-- The constraint was last set in 20260602000004_cancellation_policy.sql.
-- It is missing 'bring_a_friend' (used by book_session_with_friend) and
-- 'weekly_visit_bonus' (introduced below). We drop and recreate it here to
-- add both. The delta constraint and reference_type constraint are unchanged.
-- =============================================================================
ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_reason_check;
ALTER TABLE public.points_ledger
  ADD CONSTRAINT points_ledger_reason_check CHECK (reason IN (
    'session_attended',
    'weekly_visit_bonus',
    'assignment_completed',
    'pr_hit',
    'redemption',
    'manual_adjustment',
    'achievement_bonus',
    'booking_cancelled',
    'bring_a_friend'
  ));


-- =============================================================================
-- §2  tenant_settings TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key        text    NOT NULL,
  value      text    NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_settings_tenant_key_unique UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id
  ON public.tenant_settings (tenant_id);

CREATE TRIGGER trg_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: admins and service_role can write; all tenant members can read their
-- own tenant's settings.
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_settings_select ON public.tenant_settings
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_settings_admin_all ON public.tenant_settings
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'app_role') IN ('admin', 'super_admin')
          AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK ((auth.jwt() ->> 'app_role') IN ('admin', 'super_admin')
              AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

GRANT SELECT ON public.tenant_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_settings TO service_role;

-- Seed the default bring_a_friend_points for Infinite Hitting.
-- Idempotent: ON CONFLICT DO NOTHING.
INSERT INTO public.tenant_settings (tenant_id, key, value)
VALUES ('00000000-0000-0000-0000-000000000001', 'bring_a_friend_points', '100')
ON CONFLICT (tenant_id, key) DO NOTHING;


-- =============================================================================
-- §3  TIERED WEEKLY-VISIT BONUS  (replaces flat +10 award_booking_completion_points)
-- =============================================================================

-- Drop the old trigger (not the function — existing ledger rows reference it
-- for historical display; the function can stay as dead code).
DROP TRIGGER IF EXISTS trg_bookings_award_completion_points ON public.bookings;

-- New function ----------------------------------------------------------------
-- Counts how many non-guest bookings the kid has completed in the current
-- ISO week (Monday–Sunday) — including the booking that just transitioned.
-- Determines the incremental award for THIS visit:
--   visit 1 → +2 pts
--   visit 2 → +3 pts
--   visit 3+ → +5 pts each
--
-- Idempotency: a partial unique index on (reference_id) WHERE
-- reason = 'weekly_visit_bonus' AND reference_type = 'booking' ensures
-- each booking can only produce one ledger row regardless of how many times
-- the row is updated to 'completed'.
--
-- Note: is_guest bookings are excluded from the weekly count so a
-- Bring-a-Friend guest booking does not pad the member's visit tally.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.award_weekly_visit_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_week_count  int;
  v_award       int;
  v_new_balance int;
BEGIN
  -- Only fire on transitions INTO 'completed'.
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed'                THEN RETURN NEW; END IF;

  -- Skip guest bookings — they don't count toward the member's weekly visit tally.
  IF NEW.is_guest THEN RETURN NEW; END IF;

  -- Count completed (non-guest) bookings for this kid in the current ISO week.
  -- date_trunc('week', ...) truncates to Monday 00:00 UTC (ISO week start).
  -- NEW.id is already 'completed' in the table (AFTER UPDATE), so it is
  -- included in this count, giving us this-visit's ordinal position.
  SELECT COUNT(*)::int
    INTO v_week_count
    FROM public.bookings
   WHERE kid_id      = NEW.kid_id
     AND tenant_id   = NEW.tenant_id
     AND status      = 'completed'
     AND is_guest    = false
     AND date_trunc('week', scheduled_start AT TIME ZONE 'UTC')
       = date_trunc('week', NEW.scheduled_start AT TIME ZONE 'UTC');

  -- Determine the incremental award for this visit.
  v_award := CASE
    WHEN v_week_count = 1 THEN 2
    WHEN v_week_count = 2 THEN 3
    ELSE 5
  END;

  -- Guard with the partial unique index; duplicate triggers are a graceful no-op.
  BEGIN
    UPDATE public.kids
       SET points_balance = points_balance + v_award
     WHERE id = NEW.kid_id
     RETURNING points_balance INTO v_new_balance;

    INSERT INTO public.points_ledger (
      tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
    ) VALUES (
      NEW.tenant_id,
      NEW.kid_id,
      v_award,
      'weekly_visit_bonus',
      'booking',
      NEW.id,
      v_new_balance,
      'Visit ' || v_week_count || ' this week (+' || v_award || ' pts)'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Already credited for this booking — undo the balance bump.
    UPDATE public.kids
       SET points_balance = points_balance - v_award
     WHERE id = NEW.kid_id;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.award_weekly_visit_points() OWNER TO postgres;

CREATE TRIGGER trg_bookings_award_weekly_visit_points
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.award_weekly_visit_points();

-- Partial unique index backing the idempotency guard.
-- A single booking can only ever produce one 'weekly_visit_bonus' ledger row.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_ledger_weekly_visit_bonus
  ON public.points_ledger (reference_id)
  WHERE reason = 'weekly_visit_bonus' AND reference_type = 'booking';


-- =============================================================================
-- §4  CONFIGURABLE BRING-A-FRIEND POINTS
-- =============================================================================
-- Re-creates book_session_with_friend() with a tenant_settings lookup for the
-- bonus amount. Falls back to 100 pts if the row is absent.
-- All other logic is identical to 20260606000001_book_with_friend_rpc.sql.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.book_session_with_friend(
  p_tenant_id       uuid,
  p_location_id     uuid,
  p_kid_id          uuid,
  p_coach_id        uuid,
  p_session_type_id uuid,
  p_scheduled_start timestamptz,
  p_scheduled_end   timestamptz,
  p_guest_name      text,
  p_guest_phone     text DEFAULT NULL,
  p_guest_email     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role              text;
  v_caller_tenant     uuid;
  v_membership_id     uuid;
  v_remaining         integer;
  v_new_remaining     integer;
  v_primary_id        uuid;
  v_guest_id          uuid;
  v_baf_points        int;
BEGIN
  -- ── Auth checks ──────────────────────────────────────────────────────────
  v_role          := auth.jwt() ->> 'app_role';
  v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;

  IF v_role <> 'super_admin' AND v_caller_tenant IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_role = 'parent' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   public.kids k
      JOIN   public.families f ON f.id = k.family_id
      WHERE  k.id             = p_kid_id
        AND  f.parent_user_id = auth.uid()
        AND  f.tenant_id      = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Validate all referenced entities belong to the caller's tenant ───────
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE  id = p_location_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  IF p_coach_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.coaches
    WHERE  id = p_coach_id AND tenant_id = p_tenant_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.session_types
    WHERE  id = p_session_type_id AND tenant_id = p_tenant_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  -- ── Resolve Bring-a-Friend bonus amount from tenant_settings ─────────────
  -- Falls back to 100 pts if the operator has not configured the key.
  SELECT COALESCE(
    (SELECT value::int
       FROM public.tenant_settings
      WHERE tenant_id = p_tenant_id
        AND key = 'bring_a_friend_points'
      LIMIT 1),
    100
  ) INTO v_baf_points;

  -- ── Deduct 2 credits atomically ───────────────────────────────────────────
  SELECT id, sessions_remaining
  INTO   v_membership_id, v_remaining
  FROM   public.memberships
  WHERE  kid_id    = p_kid_id
    AND  tenant_id = p_tenant_id
    AND  plan_type = 'otc'
    AND  status    = 'active'
    AND  sessions_remaining IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_new_remaining := -1;
  ELSE
    IF v_remaining < 2 THEN
      RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.memberships
    SET    sessions_remaining = sessions_remaining - 2,
           updated_at         = now()
    WHERE  id = v_membership_id
    RETURNING sessions_remaining INTO v_new_remaining;
  END IF;

  -- ── Insert primary booking ────────────────────────────────────────────────
  INSERT INTO public.bookings (
    tenant_id, location_id, kid_id, coach_id, session_type_id,
    scheduled_start, scheduled_end, status, is_guest
  )
  VALUES (
    p_tenant_id, p_location_id, p_kid_id, p_coach_id, p_session_type_id,
    p_scheduled_start, p_scheduled_end, 'confirmed', false
  )
  RETURNING id INTO v_primary_id;

  -- ── Insert guest booking ──────────────────────────────────────────────────
  INSERT INTO public.bookings (
    tenant_id, location_id, kid_id, coach_id, session_type_id,
    scheduled_start, scheduled_end, status,
    is_guest, guest_name, guest_phone, guest_email
  )
  VALUES (
    p_tenant_id, p_location_id, p_kid_id, p_coach_id, p_session_type_id,
    p_scheduled_start, p_scheduled_end, 'confirmed',
    true, p_guest_name, p_guest_phone, p_guest_email
  )
  RETURNING id INTO v_guest_id;

  -- ── Award operator-configured Bring-a-Friend bonus points ─────────────────
  INSERT INTO public.points_ledger (kid_id, tenant_id, delta, reason)
  VALUES (p_kid_id, p_tenant_id, v_baf_points, 'bring_a_friend');

  RETURN jsonb_build_object(
    'primary_booking_id',  v_primary_id,
    'guest_booking_id',    v_guest_id,
    'sessions_remaining',  v_new_remaining
  );
END;
$$;

ALTER FUNCTION public.book_session_with_friend(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text
) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.book_session_with_friend(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text
) TO authenticated;


-- =============================================================================
-- §4b  Update achievements trigger to fire on weekly_visit_bonus
-- =============================================================================
-- The _achievements_after_points_ledger trigger (20260511000000) only fires
-- _grant_achievement(kid, 'first_session_attended') for reason='session_attended'.
-- New bookings use reason='weekly_visit_bonus', so we patch the trigger function
-- to treat both reasons as equivalent for the first-session achievement.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._achievements_after_points_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.reason IN ('session_attended', 'weekly_visit_bonus') THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_session_attended');
  ELSIF NEW.reason = 'pr_hit' THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_pr');
  ELSIF NEW.reason = 'redemption' THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_reward_redeemed');
  ELSIF NEW.reason = 'assignment_completed' THEN
    SELECT COUNT(*) INTO v_count
      FROM public.points_ledger
     WHERE kid_id = NEW.kid_id AND reason = 'assignment_completed';
    IF v_count >= 1 THEN
      PERFORM public._grant_achievement(NEW.kid_id, 'first_assignment_done');
    END IF;
    IF v_count >= 10 THEN
      PERFORM public._grant_achievement(NEW.kid_id, 'ten_assignments_done');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public._achievements_after_points_ledger() OWNER TO postgres;


-- =============================================================================
-- §5  UPDATE undo_check_in — reverse weekly_visit_bonus instead of session_attended
-- =============================================================================
-- The undo_check_in RPC (20260606000000_fix_checkin_rpcs_service_role_bypass.sql)
-- reverses points by finding the ledger row for the booking with
-- reason = 'session_attended'. New bookings will have reason = 'weekly_visit_bonus'.
-- We update the function to match either reason so both old and new ledger rows
-- can be reversed correctly.
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
