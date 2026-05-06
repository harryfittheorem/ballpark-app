-- =============================================================================
-- Ballpark — v0.5 Earn schema (rewards + store + points ledger)
-- =============================================================================
-- Adds the three foundation tables for v0.5:
--   - products         (tenant-scoped catalogue; supports redeem-with-points,
--                       purchase-with-card, or both via the two boolean flags)
--   - orders           (a redemption OR a purchase; payment_method discriminates)
--   - points_ledger    (every points delta, append-only audit log)
--
-- Plus:
--   - gen_redemption_code()                 helper, 8-char alphanumeric
--   - redeem_reward_for_kid(kid, product)   SECURITY DEFINER RPC: parent-driven
--                                           atomic spend + order create
--   - award_booking_completion_points()     trigger on bookings status change to
--                                           'completed' that credits +10 pts
--   - 8-product seed for the Infinite Hitting tenant
--
-- Conventions carried over from v0.3/v0.4:
--   - Tenant pin on every write policy (USING + WITH CHECK both reference
--     tenant_id = JWT tenant_id).
--   - App-level role checks read auth.jwt() ->> 'app_role'.
--   - Per-table GRANTs match RLS scope. RLS narrows rows; GRANTs gate the verb.
--   - Reuses public.set_updated_at().
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tables (FK order: products → orders; points_ledger references orders +
--    bookings via the polymorphic reference_type / reference_id pair)
-- -----------------------------------------------------------------------------

-- products --------------------------------------------------------------------
-- Tenant-scoped catalogue for both reward redemptions (points → product) and
-- store purchases (card → product). Either flag may be true; if both are true
-- the StoreItem screen renders dual pricing and the parent picks at checkout.
CREATE TABLE public.products (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  description         text,
  category            text        NOT NULL CHECK (category IN ('apparel', 'equipment', 'sessions', 'gear', 'experience')),
  image_url           text,
  points_cost         int         CHECK (points_cost IS NULL OR points_cost > 0),
  dollar_price_cents  int         CHECK (dollar_price_cents IS NULL OR dollar_price_cents > 0),
  is_redeemable       boolean     NOT NULL DEFAULT false,
  is_purchasable      boolean     NOT NULL DEFAULT false,
  -- inventory_count NULL = unlimited; 0 = sold out.
  inventory_count     int         CHECK (inventory_count IS NULL OR inventory_count >= 0),
  is_active           boolean     NOT NULL DEFAULT true,
  sort_order          int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- A product must offer at least one path. The matching cost field must be set.
  CONSTRAINT products_offers_a_path CHECK (is_redeemable OR is_purchasable),
  CONSTRAINT products_redeem_has_cost  CHECK (NOT is_redeemable OR points_cost IS NOT NULL),
  CONSTRAINT products_purchase_has_price CHECK (NOT is_purchasable OR dollar_price_cents IS NOT NULL)
);

-- orders ----------------------------------------------------------------------
-- One row per redemption OR purchase. payment_method discriminates and the
-- corresponding amount column is non-null. redemption_code is generated for
-- BOTH paths (front desk hands over the item against the code).
CREATE TABLE public.orders (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  family_id                 uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  kid_id                    uuid        NOT NULL REFERENCES public.kids(id) ON DELETE RESTRICT,
  product_id                uuid        NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  payment_method            text        NOT NULL CHECK (payment_method IN ('points', 'card')),
  amount_paid_points        int         CHECK (amount_paid_points IS NULL OR amount_paid_points > 0),
  amount_paid_cents         int         CHECK (amount_paid_cents IS NULL OR amount_paid_cents > 0),
  stripe_payment_intent_id  text,
  status                    text        NOT NULL DEFAULT 'ordered'
                                        CHECK (status IN ('ordered', 'fulfilled', 'cancelled', 'refunded')),
  redemption_code           text        NOT NULL UNIQUE,
  fulfilled_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_points_amount_set CHECK (
    payment_method <> 'points' OR amount_paid_points IS NOT NULL
  ),
  CONSTRAINT orders_card_amount_set CHECK (
    payment_method <> 'card' OR amount_paid_cents IS NOT NULL
  )
);

-- points_ledger ---------------------------------------------------------------
-- Append-only points history. Every grant or spend records the resulting
-- balance so we can reconcile kids.points_balance against the sum of deltas.
-- reference_type + reference_id is a polymorphic pointer to the source row
-- (booking, order, future: assignment, swing). No FK because it's polymorphic;
-- the trigger / RPC guarantees referential integrity at insert time.
CREATE TABLE public.points_ledger (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id          uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  delta           int         NOT NULL CHECK (delta <> 0),
  reason          text        NOT NULL CHECK (reason IN (
                    'session_attended',
                    'assignment_completed',
                    'pr_hit',
                    'redemption',
                    'manual_adjustment'
                  )),
  reference_type  text        CHECK (reference_type IS NULL OR reference_type IN ('booking', 'order', 'assignment', 'swing', 'manual')),
  reference_id    uuid,
  balance_after   int         NOT NULL CHECK (balance_after >= 0),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 2. Indexes on every FK column + hot lookup keys
-- -----------------------------------------------------------------------------
CREATE INDEX idx_products_tenant_id              ON public.products(tenant_id);
CREATE INDEX idx_products_active_sort            ON public.products(tenant_id, is_active, sort_order);

CREATE INDEX idx_orders_tenant_id                ON public.orders(tenant_id);
CREATE INDEX idx_orders_family_id                ON public.orders(family_id);
CREATE INDEX idx_orders_kid_id                   ON public.orders(kid_id);
CREATE INDEX idx_orders_product_id               ON public.orders(product_id);
CREATE INDEX idx_orders_created_at               ON public.orders(created_at DESC);

CREATE INDEX idx_points_ledger_tenant_id         ON public.points_ledger(tenant_id);
CREATE INDEX idx_points_ledger_kid_id_created_at ON public.points_ledger(kid_id, created_at DESC);


-- -----------------------------------------------------------------------------
-- 3. updated_at triggers (products + orders only; ledger is append-only)
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orders_updated_at   BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Helper: gen_redemption_code()
-- -----------------------------------------------------------------------------
-- 8-char base32-ish (no 0/O/1/I to avoid hand-keying confusion at the desk).
-- Collisions are extremely unlikely at scale; the UNIQUE on
-- orders.redemption_code is the safety net.
CREATE OR REPLACE FUNCTION public.gen_redemption_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text := '';
  i          int;
BEGIN
  FOR i IN 1..8 LOOP
    v_code := v_code || substr(
      v_alphabet,
      1 + floor(random() * length(v_alphabet))::int,
      1
    );
  END LOOP;
  RETURN v_code;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. RPC: redeem_reward_for_kid(p_kid_id, p_product_id)
-- -----------------------------------------------------------------------------
-- Atomically:
--   1. Validates the kid belongs to the caller's family (parent role).
--   2. Loads the product, asserts it is_active + is_redeemable + has stock.
--   3. Asserts the kid has enough points (FOR UPDATE row lock on kids).
--   4. Decrements kids.points_balance and inventory_count (when finite).
--   5. Inserts the points_ledger row (negative delta) AND the order row.
--   6. Returns the order id + redemption_code.
--
-- SECURITY DEFINER so the RLS-locked tables (kids, orders, points_ledger) can
-- be mutated atomically by a trusted function instead of via three client
-- writes. The function manually re-asserts ownership before doing any work,
-- so it does NOT widen what a parent can do — it just bundles their own
-- writes into one transaction with FOR UPDATE.
-- -----------------------------------------------------------------------------
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
  LOOP
    v_attempts := v_attempts + 1;
    v_code := public.gen_redemption_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE redemption_code = v_code);
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


-- -----------------------------------------------------------------------------
-- 6. Trigger: award_booking_completion_points
-- -----------------------------------------------------------------------------
-- When a booking flips into 'completed', award +10 to the kid and write a
-- ledger row pointing back at the booking. Idempotent guard via unique check
-- on the ledger (a single (kid_id, reference_type='booking', reference_id)
-- pair can only ever exist once, enforced by a partial unique index below).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_booking_completion_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_award       constant int := 10;
  v_new_balance int;
  v_already     boolean;
BEGIN
  -- Only fire on transitions INTO 'completed'.
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: don't double-award if a prior attempt already inserted
  -- (e.g. an admin script flipped the row back and forth).
  SELECT EXISTS (
    SELECT 1 FROM public.points_ledger
     WHERE kid_id = NEW.kid_id
       AND reason = 'session_attended'
       AND reference_type = 'booking'
       AND reference_id = NEW.id
  ) INTO v_already;
  IF v_already THEN
    RETURN NEW;
  END IF;

  UPDATE public.kids
     SET points_balance = points_balance + v_award
   WHERE id = NEW.kid_id
   RETURNING points_balance INTO v_new_balance;

  INSERT INTO public.points_ledger (
    tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
  ) VALUES (
    NEW.tenant_id, NEW.kid_id, v_award, 'session_attended', 'booking', NEW.id, v_new_balance, 'Session completed'
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.award_booking_completion_points() OWNER TO postgres;

CREATE TRIGGER trg_bookings_award_completion_points
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.award_booking_completion_points();

-- Partial unique index that backs the idempotency guard above. A booking can
-- only generate a single 'session_attended' ledger row.
CREATE UNIQUE INDEX uniq_points_ledger_booking_completion
  ON public.points_ledger (reference_id)
  WHERE reason = 'session_attended' AND reference_type = 'booking';


-- -----------------------------------------------------------------------------
-- 7. RLS: enable on all 3 tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 8. RLS policies
-- -----------------------------------------------------------------------------

-- products: SELECT within own tenant. Inactive rows are visible too so order
-- history can still join product names; the catalogue queries filter
-- is_active in the API layer.
CREATE POLICY products_select_tenant ON public.products
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- orders: parent SELECT for own family; coach SELECT for own tenant (so the
-- front desk can verify a redemption code at pickup).
CREATE POLICY orders_select_own_family ON public.orders
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
  );

CREATE POLICY orders_select_coach ON public.orders
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- No client INSERT/UPDATE/DELETE on orders for v0.5: redemption goes through
-- the SECURITY DEFINER RPC; card purchases will land via Stripe Edge Function
-- in v0.5+. Adding a policy now would only invite mistakes.

-- points_ledger: parent SELECT for own kids; coach SELECT for own tenant.
-- All writes are server-side (trigger + RPC, both SECURITY DEFINER).
CREATE POLICY points_ledger_select_own_family ON public.points_ledger
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
  );

CREATE POLICY points_ledger_select_coach ON public.points_ledger
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );


-- -----------------------------------------------------------------------------
-- 9. GRANTs (RLS narrows rows; GRANTs gate the verb).
--    Privilege model:
--      products       authenticated: SELECT
--      orders         authenticated: SELECT (writes via RPC / Edge Function)
--      points_ledger  authenticated: SELECT (writes via trigger / RPC only)
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.products      TO authenticated;
GRANT SELECT ON public.orders        TO authenticated;
GRANT SELECT ON public.points_ledger TO authenticated;


-- -----------------------------------------------------------------------------
-- 10. Seed: 8 products for Infinite Hitting
-- -----------------------------------------------------------------------------
-- Mix of redeem-only (rewards), purchase-only (store), and dual-pricing items.
-- sort_order keeps the rendering deterministic so the Rewards / Store grids
-- stay stable across reloads.
INSERT INTO public.products (
  id, tenant_id, name, description, category, image_url,
  points_cost, dollar_price_cents,
  is_redeemable, is_purchasable, inventory_count, sort_order
) VALUES
  -- Redeem-only rewards
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001',
   'Free Cage Hour',
   'One free hour in any open cage. Redeem at the front desk.',
   'sessions', NULL,
   500, NULL, true, false, NULL, 10),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001',
   'IH Wristband',
   'Infinite Hitting silicone wristband — gold on dark.',
   'apparel', NULL,
   150, NULL, true, false, 50, 20),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001',
   'Coach 1-on-1 (15 min)',
   'A focused 15-minute swing review with your home coach.',
   'experience', NULL,
   750, NULL, true, false, NULL, 30),
  -- Dual-pricing items
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001',
   'IH T-Shirt',
   'Premium cotton tee, gold IH crest on the chest.',
   'apparel', NULL,
   1200, 2500, true, true, 30, 40),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000001',
   'IH Hat',
   'Six-panel performance cap with curved brim.',
   'apparel', NULL,
   900, 2000, true, true, 25, 50),
  ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000001',
   'Batting Gloves',
   'Pro-grade leather batting gloves. Multiple sizes at the desk.',
   'gear', NULL,
   2000, 3500, true, true, 15, 60),
  -- Purchase-only items
  ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000001',
   'Wood Bat (33")',
   'Maple wood bat, 33", balanced load. Game-ready.',
   'equipment', NULL,
   NULL, 8500, false, true, 8, 70),
  ('00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000001',
   'IH Hoodie',
   'Heavyweight pullover hoodie, embroidered IH logo.',
   'apparel', NULL,
   NULL, 5500, false, true, 12, 80)
ON CONFLICT (id) DO NOTHING;
