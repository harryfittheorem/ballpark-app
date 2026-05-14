-- =============================================================================
-- Card order fulfillment support
-- =============================================================================
-- Three changes needed for Stripe Connect Phase 2 card checkout:
--
-- 1. reserve_product_inventory(p_product_id) → BOOLEAN
--    Called from stripe-create-payment-intent BEFORE creating the Stripe
--    PaymentIntent. Atomically decrements inventory_count WHERE > 0 and
--    returns TRUE if decrement happened, FALSE if already at 0 (sold out).
--    For unlimited-stock products (inventory_count IS NULL) always returns TRUE
--    (no decrement needed). Service-role only.
--
-- 2. restore_product_inventory(p_product_id)
--    Compensation function — increments inventory_count by 1 for finite-stock
--    products only. Called on PI creation failure (Edge Function) or on
--    payment_intent.canceled / payment_intent.payment_failed (webhook) to
--    return inventory that was reserved but never consumed. Service-role only.
--
-- 3. Update mark_redemption_fulfilled to accept card orders
--    The original RPC (v0.7) only allowed payment_method='points' orders.
--    Card orders (Stripe Phase 2) follow the same front-desk pickup flow:
--      payment_pending → ordered (webhook) → fulfilled (staff QR scan)
--    This migration removes the points-only guard so the existing portal
--    /admin/redemptions QR scanner works for card orders too.
-- =============================================================================

-- ─── 1. reserve_product_inventory ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_product_inventory(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated int;
  v_count   int;
BEGIN
  -- First check if this is a finite-stock product
  SELECT inventory_count INTO v_count FROM public.products WHERE id = p_product_id;

  -- Unlimited stock (NULL) — no decrement needed, always available
  IF v_count IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Try to atomically decrement if still in stock
  UPDATE public.products
     SET inventory_count = inventory_count - 1,
         updated_at      = now()
   WHERE id = p_product_id
     AND inventory_count > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- TRUE = reservation succeeded; FALSE = sold out (inventory was 0)
  RETURN v_updated > 0;
END;
$$;

ALTER FUNCTION public.reserve_product_inventory(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.reserve_product_inventory(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_product_inventory(uuid) TO service_role;

-- ─── 2. restore_product_inventory ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.restore_product_inventory(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only restore for finite-stock products (inventory_count IS NOT NULL).
  -- Unlimited products (NULL) were not decremented, so nothing to restore.
  UPDATE public.products
     SET inventory_count = inventory_count + 1,
         updated_at      = now()
   WHERE id = p_product_id
     AND inventory_count IS NOT NULL;
END;
$$;

ALTER FUNCTION public.restore_product_inventory(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.restore_product_inventory(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.restore_product_inventory(uuid) TO service_role;

-- ─── 3. Update mark_redemption_fulfilled to accept card orders ───────────────
-- Remove the payment_method='points' guard. Card orders in 'ordered' status
-- (payment confirmed by Stripe) may now be fulfilled at the front desk via
-- the existing QR scanner in /admin/redemptions. All other guards remain:
--   • admin-only (app_role='admin')
--   • tenant isolation (tenant_id matches JWT claim)
--   • status must be 'ordered' (not already fulfilled/cancelled)

CREATE OR REPLACE FUNCTION public.mark_redemption_fulfilled(p_code text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_app_role  text := auth.jwt() ->> 'app_role';
  v_jwt_tenant_id uuid;
  v_order     public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: not authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_app_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: caller is not an admin' USING ERRCODE = '42501';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE redemption_code = upper(btrim(p_code))
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: code % not found', p_code USING ERRCODE = 'P0002';
  END IF;
  IF v_order.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_order.fulfilled_at IS NOT NULL THEN
    RETURN v_order;  -- idempotent re-tap on an already-fulfilled order
  END IF;

  -- Guard: only 'ordered' status may be fulfilled (payment must be confirmed).
  -- Accepts both payment_method='points' and payment_method='card'.
  -- Cancelled, refunded, payment_failed, and payment_pending orders are terminal
  -- or not yet ready — refuse so a mistyped code never silently mutates state.
  IF v_order.status <> 'ordered' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: order % status is %, expected ordered',
      v_order.id, v_order.status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
     SET status               = 'fulfilled',
         fulfilled_at         = now(),
         fulfilled_by_user_id = v_user_id
   WHERE id = v_order.id
   RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

ALTER FUNCTION public.mark_redemption_fulfilled(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.mark_redemption_fulfilled(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mark_redemption_fulfilled(text) TO authenticated;
