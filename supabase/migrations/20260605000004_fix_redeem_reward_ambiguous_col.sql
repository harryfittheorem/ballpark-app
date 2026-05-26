-- Fix ambiguous column reference in redeem_reward_for_kid.
-- The original function body had:
--   EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE redemption_code = v_code);
-- PostgreSQL 42702: "redemption_code" is ambiguous — it matches both the RETURNS TABLE
-- output variable and the orders.redemption_code column.
-- Fix: table-qualify the column reference as orders.redemption_code.

CREATE OR REPLACE FUNCTION public.redeem_reward_for_kid(
  p_kid_id    uuid,
  p_product_id uuid
)
RETURNS TABLE (
  order_id        uuid,
  redemption_code text,
  new_balance     int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_jwt_tenant_id  uuid;
  v_kid            public.kids%ROWTYPE;
  v_family         public.families%ROWTYPE;
  v_product        public.products%ROWTYPE;
  v_new_balance    int;
  v_code           text;
  v_attempts       int := 0;
  v_order_id       uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: not authenticated' USING ERRCODE = '28000';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  -- Lock the kid row for update; resolves the family via the FK.
  SELECT * INTO v_kid
    FROM public.kids
   WHERE id = p_kid_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: kid % not found', p_kid_id USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_family
    FROM public.families
   WHERE id = v_kid.family_id;

  IF v_family.parent_user_id <> v_user_id THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: kid does not belong to caller' USING ERRCODE = '42501';
  END IF;

  IF v_family.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  -- Lock the product row to prevent inventory race.
  SELECT * INTO v_product
    FROM public.products
   WHERE id = p_product_id
     AND tenant_id = v_jwt_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: product % not found', p_product_id USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_product.is_active THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: product is inactive' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_product.is_redeemable OR v_product.points_cost IS NULL THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: product not redeemable for points' USING ERRCODE = 'P0001';
  END IF;

  IF v_product.inventory_count IS NOT NULL AND v_product.inventory_count <= 0 THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: product is sold out' USING ERRCODE = 'P0001';
  END IF;

  IF v_kid.points_balance < v_product.points_cost THEN
    RAISE EXCEPTION 'redeem_reward_for_kid: insufficient points (have %, need %)',
      v_kid.points_balance, v_product.points_cost
      USING ERRCODE = 'P0001';
  END IF;

  -- Generate a unique redemption code; retry on the (vanishingly rare) collision.
  -- NOTE: orders.redemption_code is table-qualified to avoid 42702 ambiguity with
  -- the RETURNS TABLE output variable of the same name.
  LOOP
    v_attempts := v_attempts + 1;
    v_code := public.gen_redemption_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE orders.redemption_code = v_code);
    IF v_attempts > 8 THEN
      RAISE EXCEPTION 'redeem_reward_for_kid: failed to generate unique code' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  v_new_balance := v_kid.points_balance - v_product.points_cost;

  -- 1) Decrement the balance.
  UPDATE public.kids
     SET points_balance = v_new_balance
   WHERE id = v_kid.id;

  -- 2) Decrement inventory if it's tracked.
  IF v_product.inventory_count IS NOT NULL THEN
    UPDATE public.products
       SET inventory_count = v_product.inventory_count - 1
     WHERE id = v_product.id;
  END IF;

  -- 3) Insert the order.
  INSERT INTO public.orders (
    tenant_id, family_id, kid_id, product_id,
    payment_method, amount_paid_points,
    status, redemption_code
  ) VALUES (
    v_jwt_tenant_id, v_family.id, v_kid.id, v_product.id,
    'points', v_product.points_cost,
    'ordered', v_code
  )
  RETURNING id INTO v_order_id;

  -- 4) Insert the ledger entry.
  INSERT INTO public.points_ledger (
    tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
  ) VALUES (
    v_jwt_tenant_id, v_kid.id, -v_product.points_cost, 'redemption', 'order', v_order_id,
    v_new_balance, v_product.name
  );

  order_id := v_order_id;
  redemption_code := v_code;
  new_balance := v_new_balance;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.redeem_reward_for_kid(uuid, uuid) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.redeem_reward_for_kid(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.redeem_reward_for_kid(uuid, uuid) TO authenticated;
