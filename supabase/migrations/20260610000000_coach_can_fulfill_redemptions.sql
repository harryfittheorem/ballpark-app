-- Allow coaches (in addition to admins) to call mark_redemption_fulfilled.
-- Coaches staff the front desk and need to scan + close redemptions from the
-- mobile app. All other guards (tenant match, status='ordered', payment_method
-- check) are unchanged.

CREATE OR REPLACE FUNCTION public.mark_redemption_fulfilled(p_code text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_app_role      text := auth.jwt() ->> 'app_role';
  v_jwt_tenant_id uuid;
  v_order         public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_app_role NOT IN ('admin', 'coach') THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: caller must be admin or coach' USING ERRCODE = '42501';
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

  -- Idempotent: re-scanning an already-fulfilled order just returns it.
  IF v_order.fulfilled_at IS NOT NULL THEN
    RETURN v_order;
  END IF;

  -- Only 'ordered' status may be fulfilled.
  IF v_order.status <> 'ordered' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: order % status is %, expected ordered',
      v_order.id, v_order.status USING ERRCODE = '55000';
  END IF;

  UPDATE public.orders
     SET status        = 'fulfilled',
         fulfilled_at  = now(),
         updated_at    = now()
   WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

ALTER FUNCTION public.mark_redemption_fulfilled(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.mark_redemption_fulfilled(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mark_redemption_fulfilled(text) TO authenticated;
