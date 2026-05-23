-- ============================================================
-- Task #241: Promo codes for membership signup
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PROMO_CODES TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code                     text        NOT NULL,
  stripe_coupon_id         text,
  stripe_promotion_code_id text,
  discount_type            text        NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value           integer     NOT NULL CHECK (discount_value > 0),
  max_redemptions          integer     CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemptions_used         integer     NOT NULL DEFAULT 0 CHECK (redemptions_used >= 0),
  -- applicable_plan_names: plan_name values (e.g. 'Elite Monthly', 'Standard EFT') this
  -- code is valid for. Empty array = valid for any plan in the tenant.
  applicable_plan_names    text[]      NOT NULL DEFAULT '{}',
  expires_at               timestamptz,
  is_active                boolean     NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- One code string per tenant (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_tenant_code_uniq
  ON public.promo_codes (tenant_id, lower(code));

CREATE INDEX IF NOT EXISTS promo_codes_tenant_idx  ON public.promo_codes (tenant_id);
CREATE INDEX IF NOT EXISTS promo_codes_active_idx  ON public.promo_codes (tenant_id, is_active);

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY promo_codes_admin_select ON public.promo_codes
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
  );

CREATE POLICY promo_codes_admin_insert ON public.promo_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
  );

CREATE POLICY promo_codes_admin_update ON public.promo_codes
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
  );

CREATE POLICY promo_codes_service_all ON public.promo_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- validate_promo_code RPC  (READ-ONLY — no state change)
--
-- Called by the portal/app UI to show a discount preview before activation.
-- Does NOT increment redemptions_used. Use consume_promo_code for activation.
--
-- p_plan_name: the membership's plan_name string (e.g. 'Elite Monthly').
--   Passed during both preview and activation so PLAN_MISMATCH can fire when
--   applicable_plan_names is non-empty and the plan is not in the list.
--   NULL means "skip plan check" (e.g. standalone code lookup without a membership).
--
-- Security: verifies caller is admin/owner on the correct tenant via JWT.
-- Returns:
--   { ok: true, id, code, discount_type, discount_value, stripe_promotion_code_id }
--   { ok: false, error_code: 'INVALID'|'EXPIRED'|'EXHAUSTED'|'PLAN_MISMATCH'|'FORBIDDEN' }
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_code      text,
  p_plan_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_role      text;
  v_row       public.promo_codes%ROWTYPE;
BEGIN
  -- Verify caller is admin or owner for this tenant
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  v_role      := (auth.jwt() ->> 'app_role');
  IF v_tenant_id IS NULL OR v_role NOT IN ('admin', 'owner') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  END IF;

  -- Look up the code (case-insensitive) for this tenant
  SELECT *
    INTO v_row
    FROM public.promo_codes
   WHERE tenant_id = v_tenant_id
     AND lower(code) = lower(p_code)
   LIMIT 1;

  IF NOT FOUND OR NOT v_row.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID');
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EXPIRED');
  END IF;

  -- Soft cap check (not locked — use consume_promo_code for hard enforcement)
  IF v_row.max_redemptions IS NOT NULL AND v_row.redemptions_used >= v_row.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EXHAUSTED');
  END IF;

  -- Plan mismatch: only check when applicable_plan_names is non-empty AND p_plan_name provided
  IF p_plan_name IS NOT NULL
     AND array_length(v_row.applicable_plan_names, 1) > 0
     AND NOT (p_plan_name = ANY(v_row.applicable_plan_names)) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PLAN_MISMATCH');
  END IF;

  RETURN jsonb_build_object(
    'ok',                       true,
    'id',                       v_row.id,
    'code',                     v_row.code,
    'discount_type',            v_row.discount_type,
    'discount_value',           v_row.discount_value,
    'stripe_promotion_code_id', v_row.stripe_promotion_code_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, text) TO authenticated;

COMMENT ON FUNCTION public.validate_promo_code IS
  'Read-only promo code preview. Caller must be admin/owner. Does NOT increment redemptions_used.';

-- ────────────────────────────────────────────────────────────
-- consume_promo_code RPC  (ATOMIC validate + increment)
--
-- Called during membership activation AFTER Stripe succeeds.
-- Uses SELECT FOR UPDATE to prevent concurrent over-redemption races.
--
-- Security: verifies caller is admin/owner on the correct tenant via JWT.
-- On success: atomically increments redemptions_used and returns ok=true.
-- On failure: returns ok=false with error_code — no DB change.
--
-- Concurrency guarantee: two concurrent activations of a code with max_redemptions=1
-- will serialize on the row lock; only one will succeed with EXHAUSTED returned to
-- the other. The caller (activate route) must cancel the Stripe subscription if
-- EXHAUSTED is returned.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_promo_code(
  p_code      text,
  p_plan_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_role      text;
  v_row       public.promo_codes%ROWTYPE;
BEGIN
  -- Verify caller is admin or owner for this tenant
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  v_role      := (auth.jwt() ->> 'app_role');
  IF v_tenant_id IS NULL OR v_role NOT IN ('admin', 'owner') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  END IF;

  -- Lock the row to serialize concurrent consumption
  SELECT *
    INTO v_row
    FROM public.promo_codes
   WHERE tenant_id = v_tenant_id
     AND lower(code) = lower(p_code)
     FOR UPDATE;

  IF NOT FOUND OR NOT v_row.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID');
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EXPIRED');
  END IF;

  -- Hard cap check under the row lock — prevents over-redemption races
  IF v_row.max_redemptions IS NOT NULL AND v_row.redemptions_used >= v_row.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EXHAUSTED');
  END IF;

  -- Plan mismatch
  IF p_plan_name IS NOT NULL
     AND array_length(v_row.applicable_plan_names, 1) > 0
     AND NOT (p_plan_name = ANY(v_row.applicable_plan_names)) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PLAN_MISMATCH');
  END IF;

  -- All checks passed: atomically increment redemptions_used
  UPDATE public.promo_codes
     SET redemptions_used = redemptions_used + 1
   WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok',                       true,
    'id',                       v_row.id,
    'code',                     v_row.code,
    'discount_type',            v_row.discount_type,
    'discount_value',           v_row.discount_value,
    'stripe_promotion_code_id', v_row.stripe_promotion_code_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_promo_code(text, text) TO authenticated;

COMMENT ON FUNCTION public.consume_promo_code IS
  'Atomically validates and consumes a promo code (FOR UPDATE prevents concurrent over-redemption). Caller must be admin/owner. Cancel the Stripe subscription if EXHAUSTED is returned.';
