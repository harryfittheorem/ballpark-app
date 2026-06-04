-- ============================================================
-- Task #427 — Credit-based booking display & enforcement
--
-- 1. membership_plans.sessions_per_week   — weekly allowance for EFT plans
-- 2. memberships.sessions_per_week        — denormalised copy (set on enrolment)
-- 3. memberships.weekly_sessions_used     — rolling counter, reset each Monday
-- 4. memberships.weekly_period_start      — date of the Monday this counter covers
-- 5. pg_cron weekly reset job
-- 6. Updated RPCs: check_session_credits, deduct_session_credit,
--    deduct_session_credits, book_session_with_friend, restore_session_credit
-- ============================================================

-- ── 1. membership_plans: sessions_per_week ───────────────────────────────────
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS sessions_per_week integer
    CHECK (sessions_per_week > 0);

-- ── 2-4. memberships: EFT weekly credit columns ──────────────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS sessions_per_week    integer CHECK (sessions_per_week > 0),
  ADD COLUMN IF NOT EXISTS weekly_sessions_used integer NOT NULL DEFAULT 0
    CHECK (weekly_sessions_used >= 0),
  ADD COLUMN IF NOT EXISTS weekly_period_start  date;

-- ── 5. Backfill weekly_period_start for active EFT memberships ───────────────
UPDATE public.memberships
SET    weekly_period_start = date_trunc('week', current_date)::date
WHERE  plan_type = 'eft'
  AND  status    = 'active'
  AND  weekly_period_start IS NULL;

-- ── 6. Backfill sessions_per_week from membership_plans to existing memberships
-- Joins on tenant_id + plan_name + plan_type (no FK stored, but plan_name is
-- denormalised from the plan at enrolment time and is effectively the key).
UPDATE public.memberships m
SET    sessions_per_week   = mp.sessions_per_week,
       weekly_period_start = COALESCE(
                               m.weekly_period_start,
                               date_trunc('week', current_date)::date
                             )
FROM   public.membership_plans mp
WHERE  mp.tenant_id        = m.tenant_id
  AND  mp.plan_type        = 'eft'
  AND  mp.name             = m.plan_name
  AND  mp.sessions_per_week IS NOT NULL
  AND  m.plan_type         = 'eft'
  AND  m.status            = 'active'
  AND  m.sessions_per_week IS NULL;

-- ── 7. pg_cron weekly reset job ──────────────────────────────────────────────
-- Runs every Monday at 00:00 UTC. Resets weekly_sessions_used and advances
-- weekly_period_start for all active EFT memberships whose period is stale.
-- Uses distinct dollar-quote tags ($do$ outer, $job$ inner) to avoid the
-- nested-$$ quoting conflict.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove old job if already scheduled (idempotent dedup via exception handler)
    BEGIN
      PERFORM cron.unschedule('reset-eft-weekly-credits');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- job didn't exist yet — that's fine
    END;

    PERFORM cron.schedule(
      'reset-eft-weekly-credits',
      '0 0 * * 1',
      $job$
        UPDATE public.memberships
        SET    weekly_sessions_used  = 0,
               weekly_period_start   = date_trunc('week', current_date)::date
        WHERE  plan_type             = 'eft'
          AND  status                = 'active'
          AND  (
               weekly_period_start IS NULL
            OR weekly_period_start < date_trunc('week', current_date)::date
          );
      $job$
    );
  END IF;
END
$do$;

-- ── Helper: current week Monday ───────────────────────────────────────────────
-- Used inline in RPCs. date_trunc('week', ...) returns Monday in ISO calendar.

-- ── 7. Updated RPCs ───────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- check_session_credits — pre-booking UI check (does NOT consume a credit)
--
-- Returns:
--   >= 0   : OTC sessions_remaining (0 = blocked)
--   >= 0   : EFT weekly_sessions_remaining when sessions_per_week IS NOT NULL
--   -1     : unlimited (EFT unlimited or untracked OTC)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_session_credits(
  p_kid_id    uuid,
  p_tenant_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role              text;
  v_remaining         integer;
  v_spw               integer;  -- sessions_per_week
  v_weekly_used       integer;
  v_period_start      date;
BEGIN
  v_role := auth.jwt() ->> 'app_role';

  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM p_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_role = 'parent' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   public.kids k
      JOIN   public.families f ON f.id = k.family_id
      WHERE  k.id            = p_kid_id
        AND  f.parent_user_id = auth.uid()
        AND  f.tenant_id      = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── OTC check ────────────────────────────────────────────────────────────
  SELECT sessions_remaining
  INTO   v_remaining
  FROM   public.memberships
  WHERE  kid_id    = p_kid_id
    AND  tenant_id = p_tenant_id
    AND  plan_type = 'otc'
    AND  status    = 'active'
    AND  sessions_remaining IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_remaining;
  END IF;

  -- ── EFT weekly check ─────────────────────────────────────────────────────
  SELECT sessions_per_week, weekly_sessions_used, weekly_period_start
  INTO   v_spw, v_weekly_used, v_period_start
  FROM   public.memberships
  WHERE  kid_id             = p_kid_id
    AND  tenant_id          = p_tenant_id
    AND  plan_type          = 'eft'
    AND  status             = 'active'
    AND  sessions_per_week  IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- If period is stale, treat used count as 0 for the check
    IF v_period_start IS NULL
       OR v_period_start < date_trunc('week', current_date)::date
    THEN
      v_weekly_used := 0;
    END IF;
    RETURN GREATEST(0, v_spw - v_weekly_used);
  END IF;

  -- No tracked OTC or limited EFT — unlimited
  RETURN -1;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- deduct_session_credit — atomically deduct 1 credit (called after booking insert)
--
-- Returns:
--   new sessions_remaining (OTC)
--   new weekly_sessions_remaining (EFT)
--   -1 for unlimited
-- Raises 'no_session_credits' if balance = 0.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_session_credit(
  p_booking_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role              text;
  v_kid_id            uuid;
  v_tenant_id         uuid;
  v_membership_id     uuid;
  v_remaining         integer;
  v_new_remaining     integer;
  v_spw               integer;
  v_weekly_used       integer;
  v_period_start      date;
  v_new_weekly_used   integer;
BEGIN
  v_role := auth.jwt() ->> 'app_role';

  SELECT kid_id, tenant_id
  INTO   v_kid_id, v_tenant_id
  FROM   public.bookings
  WHERE  id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM v_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_role = 'parent' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   public.kids k
      JOIN   public.families f ON f.id = k.family_id
      WHERE  k.id             = v_kid_id
        AND  f.parent_user_id = auth.uid()
        AND  f.tenant_id      = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── OTC path ─────────────────────────────────────────────────────────────
  SELECT id, sessions_remaining
  INTO   v_membership_id, v_remaining
  FROM   public.memberships
  WHERE  kid_id    = v_kid_id
    AND  tenant_id = v_tenant_id
    AND  plan_type = 'otc'
    AND  status    = 'active'
    AND  sessions_remaining IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_remaining <= 0 THEN
      RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.memberships
    SET    sessions_remaining = sessions_remaining - 1,
           updated_at         = now()
    WHERE  id = v_membership_id
    RETURNING sessions_remaining INTO v_new_remaining;
    RETURN v_new_remaining;
  END IF;

  -- ── EFT path ─────────────────────────────────────────────────────────────
  SELECT id, sessions_per_week, weekly_sessions_used, weekly_period_start
  INTO   v_membership_id, v_spw, v_weekly_used, v_period_start
  FROM   public.memberships
  WHERE  kid_id            = v_kid_id
    AND  tenant_id         = v_tenant_id
    AND  plan_type         = 'eft'
    AND  status            = 'active'
    AND  sessions_per_week IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Reset period if stale
    IF v_period_start IS NULL
       OR v_period_start < date_trunc('week', current_date)::date
    THEN
      v_weekly_used  := 0;
      v_period_start := date_trunc('week', current_date)::date;
    END IF;

    IF v_weekly_used >= v_spw THEN
      RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
    END IF;

    v_new_weekly_used := v_weekly_used + 1;

    UPDATE public.memberships
    SET    weekly_sessions_used  = v_new_weekly_used,
           weekly_period_start   = v_period_start,
           updated_at            = now()
    WHERE  id = v_membership_id;

    RETURN GREATEST(0, v_spw - v_new_weekly_used);
  END IF;

  -- EFT unlimited or untracked OTC
  RETURN -1;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- deduct_session_credits — atomically deduct N credits (Bring-a-Friend)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_session_credits(
  p_kid_id    uuid,
  p_n         int
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role              text;
  v_tenant_id         uuid;
  v_membership_id     uuid;
  v_remaining         integer;
  v_new_remaining     integer;
  v_spw               integer;
  v_weekly_used       integer;
  v_period_start      date;
  v_new_weekly_used   integer;
BEGIN
  IF p_n < 1 THEN
    RAISE EXCEPTION 'invalid_n' USING ERRCODE = 'P0001';
  END IF;

  v_role := auth.jwt() ->> 'app_role';

  SELECT f.tenant_id
  INTO   v_tenant_id
  FROM   public.kids k
  JOIN   public.families f ON f.id = k.family_id
  WHERE  k.id = p_kid_id
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'kid_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM v_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_role = 'parent' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   public.kids k
      JOIN   public.families f ON f.id = k.family_id
      WHERE  k.id            = p_kid_id
        AND  f.parent_user_id = auth.uid()
        AND  f.tenant_id      = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── OTC path ─────────────────────────────────────────────────────────────
  SELECT id, sessions_remaining
  INTO   v_membership_id, v_remaining
  FROM   public.memberships
  WHERE  kid_id    = p_kid_id
    AND  tenant_id = v_tenant_id
    AND  plan_type = 'otc'
    AND  status    = 'active'
    AND  sessions_remaining IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_remaining < p_n THEN
      RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.memberships
    SET    sessions_remaining = sessions_remaining - p_n,
           updated_at         = now()
    WHERE  id = v_membership_id
    RETURNING sessions_remaining INTO v_new_remaining;
    RETURN v_new_remaining;
  END IF;

  -- ── EFT path ─────────────────────────────────────────────────────────────
  SELECT id, sessions_per_week, weekly_sessions_used, weekly_period_start
  INTO   v_membership_id, v_spw, v_weekly_used, v_period_start
  FROM   public.memberships
  WHERE  kid_id            = p_kid_id
    AND  tenant_id         = v_tenant_id
    AND  plan_type         = 'eft'
    AND  status            = 'active'
    AND  sessions_per_week IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_period_start IS NULL
       OR v_period_start < date_trunc('week', current_date)::date
    THEN
      v_weekly_used  := 0;
      v_period_start := date_trunc('week', current_date)::date;
    END IF;

    IF v_weekly_used + p_n > v_spw THEN
      RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
    END IF;

    v_new_weekly_used := v_weekly_used + p_n;

    UPDATE public.memberships
    SET    weekly_sessions_used  = v_new_weekly_used,
           weekly_period_start   = v_period_start,
           updated_at            = now()
    WHERE  id = v_membership_id;

    RETURN GREATEST(0, v_spw - v_new_weekly_used);
  END IF;

  RETURN -1;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- book_session_with_friend — atomic BAF booking (2 credits)
-- Returns weekly_sessions_remaining in addition to sessions_remaining.
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_role                  text;
  v_caller_tenant         uuid;
  v_membership_id         uuid;
  v_remaining             integer;
  v_new_remaining         integer;
  v_spw                   integer;
  v_weekly_used           integer;
  v_period_start          date;
  v_new_weekly_used       integer;
  v_weekly_remaining      integer;
  v_primary_id            uuid;
  v_guest_id              uuid;
  v_is_eft                boolean := false;
BEGIN
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

  -- ── OTC: deduct 2 credits ─────────────────────────────────────────────────
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

  IF FOUND THEN
    IF v_remaining < 2 THEN
      RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.memberships
    SET    sessions_remaining = sessions_remaining - 2,
           updated_at         = now()
    WHERE  id = v_membership_id
    RETURNING sessions_remaining INTO v_new_remaining;
    v_weekly_remaining := -1;

  ELSE
    -- ── EFT: deduct 2 weekly credits ─────────────────────────────────────
    SELECT id, sessions_per_week, weekly_sessions_used, weekly_period_start
    INTO   v_membership_id, v_spw, v_weekly_used, v_period_start
    FROM   public.memberships
    WHERE  kid_id            = p_kid_id
      AND  tenant_id         = p_tenant_id
      AND  plan_type         = 'eft'
      AND  status            = 'active'
      AND  sessions_per_week IS NOT NULL
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF v_period_start IS NULL
         OR v_period_start < date_trunc('week', current_date)::date
      THEN
        v_weekly_used  := 0;
        v_period_start := date_trunc('week', current_date)::date;
      END IF;

      IF v_weekly_used + 2 > v_spw THEN
        RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
      END IF;

      v_new_weekly_used := v_weekly_used + 2;

      UPDATE public.memberships
      SET    weekly_sessions_used  = v_new_weekly_used,
             weekly_period_start   = v_period_start,
             updated_at            = now()
      WHERE  id = v_membership_id;

      v_new_remaining    := -1;
      v_weekly_remaining := GREATEST(0, v_spw - v_new_weekly_used);
      v_is_eft           := true;

    ELSE
      -- EFT unlimited or no tracked membership
      v_new_remaining    := -1;
      v_weekly_remaining := -1;
    END IF;
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

  -- ── Award 100 Bring-a-Friend bonus points ─────────────────────────────────
  INSERT INTO public.points_ledger (kid_id, tenant_id, delta, reason)
  VALUES (p_kid_id, p_tenant_id, 100, 'bring_a_friend');

  RETURN jsonb_build_object(
    'primary_booking_id',     v_primary_id,
    'guest_booking_id',       v_guest_id,
    'sessions_remaining',     v_new_remaining,
    'weekly_sessions_remaining', v_weekly_remaining
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- restore_session_credit — called on cancellation to return 1 credit
-- Handles both OTC (sessions_remaining++) and EFT (weekly_sessions_used--)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_session_credit(
  p_booking_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role            text;
  v_kid_id          uuid;
  v_tenant_id       uuid;
  v_booking_status  text;
  v_scheduled_start timestamptz;
  v_already_done    boolean;
  v_membership_id   uuid;
  v_sessions_total  integer;
  v_new_remaining   integer;
  v_spw             integer;
  v_weekly_used     integer;
  v_period_start    date;
  v_new_weekly_used integer;
BEGIN
  v_role := auth.jwt() ->> 'app_role';

  SELECT kid_id, tenant_id, status, scheduled_start, session_credit_restored
  INTO   v_kid_id, v_tenant_id, v_booking_status, v_scheduled_start, v_already_done
  FROM   public.bookings
  WHERE  id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM v_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_role = 'parent' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   public.kids k
      JOIN   public.families f ON f.id = k.family_id
      WHERE  k.id             = v_kid_id
        AND  f.parent_user_id = auth.uid()
        AND  f.tenant_id      = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_booking_status <> 'cancelled' THEN
    RAISE EXCEPTION 'booking_not_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_scheduled_start <= (now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'session_already_started' USING ERRCODE = 'P0001';
  END IF;

  IF v_already_done THEN
    RETURN -2;
  END IF;

  UPDATE public.bookings
  SET    session_credit_restored = true
  WHERE  id = p_booking_id;

  -- ── OTC restore ──────────────────────────────────────────────────────────
  SELECT id, sessions_total
  INTO   v_membership_id, v_sessions_total
  FROM   public.memberships
  WHERE  kid_id    = v_kid_id
    AND  tenant_id = v_tenant_id
    AND  plan_type = 'otc'
    AND  status    = 'active'
    AND  sessions_remaining IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.memberships
    SET    sessions_remaining = LEAST(
             sessions_remaining + 1,
             COALESCE(v_sessions_total, sessions_remaining + 1)
           ),
           updated_at = now()
    WHERE  id = v_membership_id
    RETURNING sessions_remaining INTO v_new_remaining;
    RETURN v_new_remaining;
  END IF;

  -- ── EFT weekly restore ───────────────────────────────────────────────────
  SELECT id, sessions_per_week, weekly_sessions_used, weekly_period_start
  INTO   v_membership_id, v_spw, v_weekly_used, v_period_start
  FROM   public.memberships
  WHERE  kid_id            = v_kid_id
    AND  tenant_id         = v_tenant_id
    AND  plan_type         = 'eft'
    AND  status            = 'active'
    AND  sessions_per_week IS NOT NULL
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Only restore within the current week; if the booking was in a prior
    -- week's period, the counter was already reset by cron — no-op.
    IF v_period_start IS NOT NULL
       AND v_period_start >= date_trunc('week', current_date)::date
    THEN
      v_new_weekly_used := GREATEST(0, v_weekly_used - 1);
      UPDATE public.memberships
      SET    weekly_sessions_used = v_new_weekly_used,
             updated_at           = now()
      WHERE  id = v_membership_id;
      RETURN GREATEST(0, v_spw - v_new_weekly_used);
    END IF;
    -- Period already rolled — nothing to restore
    RETURN -1;
  END IF;

  -- No tracked membership
  RETURN -1;
END;
$$;

-- ── Re-grant execute on updated functions ──────────────────────────────────
GRANT EXECUTE ON FUNCTION public.check_session_credits(uuid, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_session_credit(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_session_credits(uuid, int)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_session_with_friend(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text
)                                                                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_session_credit(uuid)                  TO authenticated;
