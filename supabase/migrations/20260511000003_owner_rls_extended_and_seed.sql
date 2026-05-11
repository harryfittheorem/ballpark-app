-- ============================================================
-- Task #160 follow-up: extend owner RLS to additional tables,
-- add admin + parent self-access on memberships/payment_events,
-- and seed paused/cancelled membership examples.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- OWNER SELECT on additional existing tables
-- ────────────────────────────────────────────────────────────

-- videos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='videos' AND policyname='videos_owner_select'
  ) THEN
    CREATE POLICY videos_owner_select ON public.videos
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='assignments' AND policyname='assignments_owner_select'
  ) THEN
    CREATE POLICY assignments_owner_select ON public.assignments
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') = 'owner'
      );
  END IF;
END $$;

-- coach_availability (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='coach_availability')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='coach_availability' AND policyname='coach_availability_owner_select'
    )
  THEN
    EXECUTE 'CREATE POLICY coach_availability_owner_select ON public.coach_availability
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid
        AND (auth.jwt() ->> ''app_role'') = ''owner''
      )';
  END IF;
END $$;

-- session_types (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='session_types')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='session_types' AND policyname='session_types_owner_select'
    )
  THEN
    EXECUTE 'CREATE POLICY session_types_owner_select ON public.session_types
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid
        AND (auth.jwt() ->> ''app_role'') = ''owner''
      )';
  END IF;
END $$;

-- locations (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='locations')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='locations' AND policyname='locations_owner_select'
    )
  THEN
    EXECUTE 'CREATE POLICY locations_owner_select ON public.locations
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid
        AND (auth.jwt() ->> ''app_role'') = ''owner''
      )';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- ADMIN policies on memberships + payment_events
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_admin_all'
  ) THEN
    CREATE POLICY memberships_admin_all ON public.memberships
      FOR ALL TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('admin','owner')
      )
      WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('admin','owner')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='payment_events' AND policyname='payment_events_admin_all'
  ) THEN
    CREATE POLICY payment_events_admin_all ON public.payment_events
      FOR ALL TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('admin','owner')
      )
      WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('admin','owner')
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- PARENT self-access: see own memberships + payment_events
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_parent_self'
  ) THEN
    CREATE POLICY memberships_parent_self ON public.memberships
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'app_role') = 'parent'
        AND family_id IN (
          SELECT id FROM public.families
          WHERE parent_user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='payment_events' AND policyname='payment_events_parent_self'
  ) THEN
    CREATE POLICY payment_events_parent_self ON public.payment_events
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'app_role') = 'parent'
        AND family_id IN (
          SELECT id FROM public.families
          WHERE parent_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SEED: add paused + cancelled membership examples
-- (using same real families/kids as migration 000002)
-- ────────────────────────────────────────────────────────────

-- Paused membership: Yug (54c7643f) — was Elite 2x/Week, now paused
INSERT INTO public.memberships
  (id, tenant_id, family_id, kid_id, plan_name, plan_type, status, amount_cents, billing_anchor_day, started_at, cancelled_at)
VALUES
  ('00000000-0000-0000-0000-000000001005',
   '00000000-0000-0000-0000-000000000001',
   '98309a11-d9fe-4cc3-9834-af79ac778ca3',
   '54c7643f-b56a-4816-9144-b8f36bbe37e4',
   'Drop-In 4-Pack', 'otc', 'paused', 14000, NULL,
   '2024-09-01 00:00:00+00', NULL)
ON CONFLICT (id) DO NOTHING;

-- Cancelled membership: Yug (cb390ca5) — cancelled after OTC pack
INSERT INTO public.memberships
  (id, tenant_id, family_id, kid_id, plan_name, plan_type, status, amount_cents, billing_anchor_day, started_at, cancelled_at)
VALUES
  ('00000000-0000-0000-0000-000000001006',
   '00000000-0000-0000-0000-000000000001',
   '8e209137-0f0e-4b6a-9c9c-7e5e3cebb1c1',
   'cb390ca5-8543-47e9-acec-d964031fa472',
   'Intro 4-Pack', 'otc', 'cancelled', 9600, NULL,
   '2024-07-15 00:00:00+00', '2024-09-01 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Additional payment events: paid and failed for the new memberships + recent events
INSERT INTO public.payment_events
  (tenant_id, family_id, membership_id, amount_cents, status, payment_method, created_at)
VALUES
  -- Drop-In 4-Pack (1005): paid upfront
  ('00000000-0000-0000-0000-000000000001','98309a11-d9fe-4cc3-9834-af79ac778ca3','00000000-0000-0000-0000-000000001005',14000,'paid','cash','2024-09-01'),

  -- Intro 4-Pack (1006): paid then refunded
  ('00000000-0000-0000-0000-000000000001','8e209137-0f0e-4b6a-9c9c-7e5e3cebb1c1','00000000-0000-0000-0000-000000001006',9600,'paid','cash','2024-07-15'),
  ('00000000-0000-0000-0000-000000000001','8e209137-0f0e-4b6a-9c9c-7e5e3cebb1c1','00000000-0000-0000-0000-000000001006',9600,'refunded','cash','2024-09-02'),

  -- Recent failed payment for Unlimited Monthly (1001) — simulates a recent billing issue
  ('00000000-0000-0000-0000-000000000001','ac9f0847-8a91-4e77-8428-c9ccf45f859c','00000000-0000-0000-0000-000000001001',29900,'failed','eft', NOW() - INTERVAL '3 days'),

  -- Retry succeeded for that same membership
  ('00000000-0000-0000-0000-000000000001','ac9f0847-8a91-4e77-8428-c9ccf45f859c','00000000-0000-0000-0000-000000001001',29900,'paid','eft', NOW() - INTERVAL '1 day')

ON CONFLICT DO NOTHING;
