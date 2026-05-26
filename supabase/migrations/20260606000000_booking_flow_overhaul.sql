-- ============================================================
-- Booking flow overhaul
--
-- 1. locations.cage_rental_enabled  — per-location opt-in for cage rentals
-- 2. bookings: is_guest + guest contact fields  — Bring-a-Friend guest row
-- 3. deduct_session_credits(p_kid_id, p_n)  — atomic N-credit deduction
--    used by Bring-a-Friend (deducts 2 in one transaction)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. locations: cage_rental_enabled toggle
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS cage_rental_enabled boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 2. bookings: Bring-a-Friend guest fields
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_guest   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_name  text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS guest_email text;

-- ─────────────────────────────────────────────────────────────
-- 3. RPC: deduct_session_credits(p_kid_id uuid, p_n int)
--
-- Atomically checks sessions_remaining >= p_n and decrements by p_n.
-- Returns the new (post-decrement) balance, or -1 for unlimited/untracked.
-- Raises 'no_session_credits' if remaining < p_n.
-- Used for Bring-a-Friend (p_n = 2).
-- ─────────────────────────────────────────────────────────────
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
  v_role          text;
  v_tenant_id     uuid;
  v_membership_id uuid;
  v_remaining     integer;
  v_new_remaining integer;
BEGIN
  IF p_n < 1 THEN
    RAISE EXCEPTION 'invalid_n' USING ERRCODE = 'P0001';
  END IF;

  v_role := auth.jwt() ->> 'app_role';

  -- Resolve tenant from the kid row
  SELECT f.tenant_id
  INTO   v_tenant_id
  FROM   public.kids k
  JOIN   public.families f ON f.id = k.family_id
  WHERE  k.id = p_kid_id
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'kid_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Tenant isolation
  IF v_role <> 'super_admin'
     AND (auth.jwt() ->> 'tenant_id')::uuid IS DISTINCT FROM v_tenant_id
  THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE = 'P0001';
  END IF;

  -- Parent: must own the family that owns this kid
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

  -- Lock the active OTC membership row for atomic decrement
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

  IF NOT FOUND THEN
    -- EFT unlimited or untracked OTC — no deduction needed
    RETURN -1;
  END IF;

  IF v_remaining < p_n THEN
    RAISE EXCEPTION 'no_session_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.memberships
  SET    sessions_remaining = sessions_remaining - p_n,
         updated_at         = now()
  WHERE  id = v_membership_id
  RETURNING sessions_remaining INTO v_new_remaining;

  RETURN v_new_remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_session_credits(uuid, int) TO authenticated;
