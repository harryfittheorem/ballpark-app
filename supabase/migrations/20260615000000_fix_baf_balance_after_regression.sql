-- Fix book_session_with_friend: restore balance_after in the points_ledger INSERT.
-- The 20260610000000_eft_weekly_credits.sql migration rewrote this function to add
-- EFT weekly-credit support but regressed the points-ledger block — it omitted
-- balance_after (NOT NULL) and stopped updating kids.points_balance. This caused
-- every Bring-a-Friend booking to fail with a not-null constraint violation.
--
-- This migration is identical to the EFT version except:
--   1. v_balance_after integer added to DECLARE block.
--   2. Points block replaced with the _0004 pattern:
--        UPDATE kids … RETURNING points_balance INTO v_balance_after
--        INSERT INTO points_ledger (… balance_after) VALUES (… v_balance_after)

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
  v_balance_after         integer;
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
  -- Increment kids.points_balance (the live column the app reads) and capture
  -- the new value so the ledger row has a correct non-null balance_after.
  UPDATE public.kids
  SET    points_balance = points_balance + 100
  WHERE  id = p_kid_id
  RETURNING points_balance INTO v_balance_after;

  INSERT INTO public.points_ledger (
    tenant_id, kid_id, delta, reason,
    reference_type, reference_id, balance_after
  )
  VALUES (
    p_tenant_id, p_kid_id, 100, 'bring_a_friend',
    'booking', v_primary_id, v_balance_after
  );

  RETURN jsonb_build_object(
    'primary_booking_id',        v_primary_id,
    'guest_booking_id',          v_guest_id,
    'sessions_remaining',        v_new_remaining,
    'weekly_sessions_remaining', v_weekly_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session_with_friend(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text
) TO authenticated;
