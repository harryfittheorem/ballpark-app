-- ============================================================
-- Task #160: memberships + payment_events tables, owner RLS,
-- and seed data for the Infinite Hitting test tenant.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- MEMBERSHIPS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memberships (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              uuid        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  family_id              uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  kid_id                 uuid        NOT NULL REFERENCES public.kids(id)     ON DELETE CASCADE,
  plan_name              text        NOT NULL,
  plan_type              text        NOT NULL CHECK (plan_type IN ('eft','otc')),
  status                 text        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active','paused','cancelled')),
  amount_cents           integer     NOT NULL CHECK (amount_cents >= 0),
  billing_anchor_day     smallint    CHECK (billing_anchor_day BETWEEN 1 AND 28),
  stripe_subscription_id text,
  started_at             timestamptz NOT NULL DEFAULT now(),
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_tenant_idx   ON public.memberships (tenant_id);
CREATE INDEX IF NOT EXISTS memberships_kid_idx      ON public.memberships (kid_id);
CREATE INDEX IF NOT EXISTS memberships_family_idx   ON public.memberships (family_id);
CREATE INDEX IF NOT EXISTS memberships_status_idx   ON public.memberships (status);

-- ────────────────────────────────────────────────────────────
-- PAYMENT EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_events (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                uuid        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  family_id                uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  membership_id            uuid        REFERENCES public.memberships(id) ON DELETE SET NULL,
  amount_cents             integer     NOT NULL CHECK (amount_cents >= 0),
  status                   text        NOT NULL CHECK (status IN ('paid','failed','refunded')),
  payment_method           text        NOT NULL CHECK (payment_method IN ('eft','card','cash')),
  stripe_payment_intent_id text,
  error_code               text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_tenant_idx     ON public.payment_events (tenant_id);
CREATE INDEX IF NOT EXISTS payment_events_family_idx     ON public.payment_events (family_id);
CREATE INDEX IF NOT EXISTS payment_events_membership_idx ON public.payment_events (membership_id);
CREATE INDEX IF NOT EXISTS payment_events_status_idx     ON public.payment_events (status);
CREATE INDEX IF NOT EXISTS payment_events_created_idx    ON public.payment_events (created_at DESC);

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.memberships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- OWNER POLICIES — new tables
-- ────────────────────────────────────────────────────────────
CREATE POLICY memberships_owner_select ON public.memberships
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'owner'
  );

CREATE POLICY memberships_service_all ON public.memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY payment_events_owner_select ON public.payment_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'owner'
  );

CREATE POLICY payment_events_service_all ON public.payment_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- OWNER POLICIES — existing tables
-- ────────────────────────────────────────────────────────────

-- families
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='families' AND policyname='families_owner_select'
  ) THEN
    CREATE POLICY families_owner_select ON public.families
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- kids (no tenant_id; gate via family → tenant)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='kids' AND policyname='kids_owner_select'
  ) THEN
    CREATE POLICY kids_owner_select ON public.kids
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'app_role') = 'owner'
        AND family_id IN (
          SELECT id FROM public.families
          WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
      );
  END IF;
END $$;

-- coaches
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coaches' AND policyname='coaches_owner_select'
  ) THEN
    CREATE POLICY coaches_owner_select ON public.coaches
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- bookings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_owner_select'
  ) THEN
    CREATE POLICY bookings_owner_select ON public.bookings
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- products
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='products_owner_select'
  ) THEN
    CREATE POLICY products_owner_select ON public.products
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='orders' AND policyname='orders_owner_select'
  ) THEN
    CREATE POLICY orders_owner_select ON public.orders
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- points_ledger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='points_ledger' AND policyname='points_ledger_owner_select'
  ) THEN
    CREATE POLICY points_ledger_owner_select ON public.points_ledger
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SEED DATA — Infinite Hitting tenant (00000000-0000-0000-0000-000000000001)
--
-- NOTE: These rows reference families/kids provisioned on the live
-- Infinite Hitting Supabase project. On a clean/fresh environment
-- these FK parents won't exist, so the entire seed block is
-- skipped safely via the DO guard below.
--
-- Real families/kids on the live DB:
--   Family ac9f0847 → Kid Harry Singh   (ad08b4ce, 12U)
--   Family 98309a11 → Kid Yug Singh     (54c7643f, 11U)
--   Family 8e209137 → Kid Yug Singh     (cb390ca5, 12U)
--   Family c84bcb7b → Kid Harry         (d98cf2ef, 13U)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Only seed if the Infinite Hitting tenant and at least one referenced
  -- family exist (i.e. this is the live project, not a blank env).
  IF EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = '00000000-0000-0000-0000-000000000001'
  ) AND EXISTS (
    SELECT 1 FROM public.families
    WHERE id = 'ac9f0847-8a91-4e77-8428-c9ccf45f859c'
  ) THEN
    INSERT INTO public.memberships
      (id, tenant_id, family_id, kid_id, plan_name, plan_type, status, amount_cents, billing_anchor_day, started_at)
    VALUES
      ('00000000-0000-0000-0000-000000001001',
       '00000000-0000-0000-0000-000000000001',
       'ac9f0847-8a91-4e77-8428-c9ccf45f859c',
       'ad08b4ce-3536-4add-8604-a9f29c3cd290',
       'Unlimited Monthly', 'eft', 'active', 29900, 5,
       '2025-01-05 00:00:00+00'),
      ('00000000-0000-0000-0000-000000001002',
       '00000000-0000-0000-0000-000000000001',
       '98309a11-d9fe-4cc3-9834-af79ac778ca3',
       '54c7643f-b56a-4816-9144-b8f36bbe37e4',
       'Elite 2x/Week', 'eft', 'active', 24900, 12,
       '2025-02-12 00:00:00+00'),
      ('00000000-0000-0000-0000-000000001003',
       '00000000-0000-0000-0000-000000000001',
       '8e209137-0f0e-4b6a-9c9c-7e5e3cebb1c1',
       'cb390ca5-8543-47e9-acec-d964031fa472',
       '8-Pack Private Lessons', 'otc', 'active', 48000, NULL,
       '2025-03-01 00:00:00+00'),
      ('00000000-0000-0000-0000-000000001004',
       '00000000-0000-0000-0000-000000000001',
       'c84bcb7b-0498-412c-b213-fec1bb0aba54',
       'd98cf2ef-6351-4284-97c5-b5c09f38b3fb',
       'Elite 1x/Week', 'eft', 'active', 17900, 18,
       '2025-03-18 00:00:00+00')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.payment_events
      (tenant_id, family_id, membership_id, amount_cents, status, payment_method, created_at)
    VALUES
      -- Membership 1001: Unlimited Monthly $299/mo EFT – Jan–May paid
      ('00000000-0000-0000-0000-000000000001','ac9f0847-8a91-4e77-8428-c9ccf45f859c','00000000-0000-0000-0000-000000001001',29900,'paid','eft','2025-02-05'),
      ('00000000-0000-0000-0000-000000000001','ac9f0847-8a91-4e77-8428-c9ccf45f859c','00000000-0000-0000-0000-000000001001',29900,'paid','eft','2025-03-05'),
      ('00000000-0000-0000-0000-000000000001','ac9f0847-8a91-4e77-8428-c9ccf45f859c','00000000-0000-0000-0000-000000001001',29900,'paid','eft','2025-04-05'),
      ('00000000-0000-0000-0000-000000000001','ac9f0847-8a91-4e77-8428-c9ccf45f859c','00000000-0000-0000-0000-000000001001',29900,'paid','eft','2025-05-05'),
      -- Membership 1002: Elite 2x/Week $249/mo EFT – Feb–Apr paid, May failed
      ('00000000-0000-0000-0000-000000000001','98309a11-d9fe-4cc3-9834-af79ac778ca3','00000000-0000-0000-0000-000000001002',24900,'paid','eft','2025-03-12'),
      ('00000000-0000-0000-0000-000000000001','98309a11-d9fe-4cc3-9834-af79ac778ca3','00000000-0000-0000-0000-000000001002',24900,'paid','eft','2025-04-12'),
      ('00000000-0000-0000-0000-000000000001','98309a11-d9fe-4cc3-9834-af79ac778ca3','00000000-0000-0000-0000-000000001002',24900,'failed','eft','2025-05-12'),
      -- Membership 1003: 8-Pack OTC $480 upfront cash
      ('00000000-0000-0000-0000-000000000001','8e209137-0f0e-4b6a-9c9c-7e5e3cebb1c1','00000000-0000-0000-0000-000000001003',48000,'paid','cash','2025-03-01'),
      -- Membership 1004: Elite 1x/Week $179/mo EFT – Apr–May paid
      ('00000000-0000-0000-0000-000000000001','c84bcb7b-0498-412c-b213-fec1bb0aba54','00000000-0000-0000-0000-000000001004',17900,'paid','eft','2025-04-18'),
      ('00000000-0000-0000-0000-000000000001','c84bcb7b-0498-412c-b213-fec1bb0aba54','00000000-0000-0000-0000-000000001004',17900,'paid','eft','2025-05-18')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
