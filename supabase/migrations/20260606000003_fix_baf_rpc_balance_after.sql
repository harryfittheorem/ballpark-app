-- Fix book_session_with_friend: supply balance_after in the points_ledger INSERT.
-- The original function omitted balance_after, which is NOT NULL — causing
-- every BAF booking to fail with a not-null constraint violation.
--
-- Pattern mirrors all other ledger inserts in the codebase:
--   1. Read current balance with COALESCE(SUM(delta), 0)
--   2. balance_after = current_balance + delta

CREATE OR REPLACE FUNCTION public.book_session_with_friend(
  p_tenant_id      uuid,
  p_location_id    uuid,
  p_kid_id         uuid,
  p_coach_id       uuid,
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
  v_current_balance   integer;
  v_balance_after     integer;
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
    -- EFT / unlimited: skip credit deduction
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

  -- ── Award 100 Bring-a-Friend bonus points ─────────────────────────────────
  -- Compute current balance first (same pattern as every other ledger insert)
  SELECT COALESCE(SUM(delta), 0)
  INTO   v_current_balance
  FROM   public.points_ledger
  WHERE  kid_id    = p_kid_id
    AND  tenant_id = p_tenant_id;

  v_balance_after := v_current_balance + 100;

  INSERT INTO public.points_ledger (
    tenant_id, kid_id, delta, reason,
    reference_type, reference_id, balance_after
  )
  VALUES (
    p_tenant_id, p_kid_id, 100, 'bring_a_friend',
    'booking', v_primary_id, v_balance_after
  );

  RETURN jsonb_build_object(
    'primary_booking_id',  v_primary_id,
    'guest_booking_id',    v_guest_id,
    'sessions_remaining',  v_new_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session_with_friend(
  uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text
) TO authenticated;
