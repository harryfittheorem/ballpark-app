-- ============================================================
-- Task #237: Session packs + credit tracking
--
-- Adds sessions_remaining / sessions_total to memberships,
-- adds session_credit_restored idempotency flag to bookings,
-- backfills existing OTC rows, adds a parent SELECT policy,
-- and creates three SECURITY DEFINER RPCs for atomic credit
-- deduction, restoration, and pre-booking checks.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SCHEMA CHANGES
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS sessions_total     integer
    CHECK (sessions_total > 0),
  ADD COLUMN IF NOT EXISTS sessions_remaining integer
    CHECK (sessions_remaining >= 0);

-- Enforce remaining ≤ total when both are set
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_remaining_lte_total'
      AND conrelid = 'public.memberships'::regclass
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT sessions_remaining_lte_total
        CHECK (
          sessions_remaining IS NULL
          OR sessions_total IS NULL
          OR sessions_remaining <= sessions_total
        );
  END IF;
END $$;

-- Idempotency flag: ensures restore_session_credit can only fire
-- once per booking regardless of how many times it is called.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS session_credit_restored boolean NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- BACKFILL: infer pack size from plan_name for OTC memberships
-- that don't already have sessions_total set.
-- ────────────────────────────────────────────────────────────
UPDATE public.memberships
SET
  sessions_total = CASE
    WHEN plan_name ILIKE '%8-pack%' OR plan_name ILIKE '%8 pack%' OR plan_name ILIKE '8-Pack%' THEN 8
    WHEN plan_name ILIKE '%4-pack%' OR plan_name ILIKE '%4 pack%' OR plan_name ILIKE '4-Pack%' THEN 4
    ELSE NULL
  END,
  sessions_remaining = CASE
    WHEN plan_name ILIKE '%8-pack%' OR plan_name ILIKE '%8 pack%' OR plan_name ILIKE '8-Pack%' THEN 8
    WHEN plan_name ILIKE '%4-pack%' OR plan_name ILIKE '%4 pack%' OR plan_name ILIKE '4-Pack%' THEN 4
    ELSE NULL
  END
WHERE plan_type = 'otc'
  AND sessions_total IS NULL;

-- ────────────────────────────────────────────────────────────
-- PARENT SELECT POLICY — families can read their own memberships
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'memberships'
      AND policyname = 'memberships_parent_select'
  ) THEN
    CREATE POLICY memberships_parent_select ON public.memberships
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'app_role') = 'parent'
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND family_id IN (
          SELECT id FROM public.families
          WHERE parent_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- RPC: check_session_credits
--
-- Returns the number of sessions remaining for the kid's active
-- OTC pack, or -1 if there is no tracked OTC membership (EFT
-- unlimited or untracked OTC).  Does NOT consume a credit.
-- Callers: mobile pre-booking UI check.
-- ────────────────────────────────────────────────────────────
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
  v_role      text;
  v_remaining integer;
BEGIN
  v_role := auth.jwt() ->> 'app_role';

  -- Tenant isolation: every caller except super_admin must be in the same tenant
  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM p_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  -- Parent callers: must own the family that owns this kid
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

  IF NOT FOUND THEN
    -- EFT unlimited or untracked OTC — no restriction
    RETURN -1;
  END IF;

  RETURN v_remaining;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RPC: deduct_session_credit
--
-- Atomically decrements sessions_remaining by 1 using FOR UPDATE.
-- Returns the new (post-decrement) balance, or -1 for unlimited
-- memberships (EFT / untracked OTC).
-- Raises 'no_session_credits' if remaining = 0.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_session_credit(
  p_booking_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          text;
  v_kid_id        uuid;
  v_tenant_id     uuid;
  v_membership_id uuid;
  v_remaining     integer;
  v_new_remaining integer;
BEGIN
  v_role := auth.jwt() ->> 'app_role';

  -- Resolve the kid & tenant from the booking
  SELECT kid_id, tenant_id
  INTO   v_kid_id, v_tenant_id
  FROM   public.bookings
  WHERE  id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Tenant isolation
  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM v_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  -- Parent: must own the family that owns the kid on this booking
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

  -- Lock the active OTC membership row for atomic decrement
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

  IF NOT FOUND THEN
    -- EFT unlimited or untracked OTC — no deduction needed
    RETURN -1;
  END IF;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.memberships
  SET    sessions_remaining = sessions_remaining - 1,
         updated_at         = now()
  WHERE  id = v_membership_id
  RETURNING sessions_remaining INTO v_new_remaining;

  RETURN v_new_remaining;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RPC: restore_session_credit
--
-- Increments sessions_remaining by 1 (capped at sessions_total)
-- when a FUTURE booking is cancelled.  Guards (all server-side):
--   1. Caller authz (parent owns family + tenant; others tenant-scoped)
--   2. Booking must have status = 'cancelled'
--   3. Booking scheduled_start must be in the future (> now()) so
--      credits cannot be regained for sessions that already occurred
--   4. Idempotent — bookings.session_credit_restored flag prevents
--      duplicate restores regardless of how many times the RPC fires
-- Returns the new balance, or -1 for unlimited/untracked memberships,
-- or -2 if the credit was already restored (idempotent no-op).
-- ────────────────────────────────────────────────────────────
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
BEGIN
  v_role := auth.jwt() ->> 'app_role';

  -- Lock the booking row to prevent concurrent restores
  SELECT kid_id, tenant_id, status, scheduled_start, session_credit_restored
  INTO   v_kid_id, v_tenant_id, v_booking_status, v_scheduled_start, v_already_done
  FROM   public.bookings
  WHERE  id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Tenant isolation
  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM v_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  -- Parent: must own the family that owns the kid on this booking
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

  -- Business rule 1: booking must be cancelled
  IF v_booking_status <> 'cancelled' THEN
    RAISE EXCEPTION 'booking_not_cancelled' USING ERRCODE = 'P0001';
  END IF;

  -- Business rule 2: session must not have already started (future only)
  -- A 10-minute grace window is applied so same-day cancellations right
  -- at the start time are still honoured.
  IF v_scheduled_start <= (now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'session_already_started' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: never restore more than once per booking
  IF v_already_done THEN
    RETURN -2;
  END IF;

  -- Mark restore as done before touching the membership (atomic within txn)
  UPDATE public.bookings
  SET    session_credit_restored = true
  WHERE  id = p_booking_id;

  -- Find the OTC membership to restore into
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

  IF NOT FOUND THEN
    -- No tracked OTC membership — nothing to restore
    RETURN -1;
  END IF;

  UPDATE public.memberships
  SET    sessions_remaining = LEAST(
           sessions_remaining + 1,
           COALESCE(v_sessions_total, sessions_remaining + 1)
         ),
         updated_at = now()
  WHERE  id = v_membership_id
  RETURNING sessions_remaining INTO v_new_remaining;

  RETURN v_new_remaining;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- GRANTS
-- ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.check_session_credits(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_session_credit(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_session_credit(uuid)      TO authenticated;
