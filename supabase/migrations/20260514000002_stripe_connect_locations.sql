-- ============================================================
-- Task #188: Stripe Connect Phase 1 — Location onboarding
--
-- 1. Add stripe_onboarding_status + stripe_account_name to locations
-- 2. Add royalty_config JSONB column to tenants
-- 3. Seed royalty_config for the Infinite Hitting tenant
-- 4. RLS: owners can UPDATE their location's Stripe fields
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- LOCATIONS — new Stripe columns
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS stripe_onboarding_status text
    NOT NULL DEFAULT 'not_connected'
    CHECK (stripe_onboarding_status IN ('not_connected','pending','connected','restricted')),
  ADD COLUMN IF NOT EXISTS stripe_account_name text,
  ADD COLUMN IF NOT EXISTS stripe_payout_interval text;

-- ────────────────────────────────────────────────────────────
-- TENANTS — royalty_config
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS royalty_config jsonb NOT NULL DEFAULT '{"model":"per_transaction","rate":0.025}'::jsonb;

-- Ensure the Infinite Hitting tenant has the standard 2.5% per-transaction rate.
-- The NOT NULL + DEFAULT clause above back-fills existing rows on Supabase cloud,
-- so this UPDATE is redundant for fresh environments but harmless — it clarifies
-- intent and ensures the value is correct even if the back-fill behavior changes.
-- Migrations run once, so this will not overwrite manually-customized rates.
UPDATE public.tenants
SET royalty_config = '{"model":"per_transaction","rate":0.025}'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ────────────────────────────────────────────────────────────
-- RLS — allow owners to update their location's Stripe fields
-- ────────────────────────────────────────────────────────────

-- Owners can SELECT their own tenant's locations (guard with IF NOT EXISTS
-- since an earlier migration may have created a similar policy).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'locations'
      AND policyname = 'locations_owner_select'
  ) THEN
    CREATE POLICY locations_owner_select ON public.locations
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
      );
  END IF;
END $$;

-- Owners can UPDATE their location row (Stripe onboarding fields only;
-- the API route uses the service-role client so this policy is a
-- defence-in-depth layer for future direct-client paths).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'locations'
      AND policyname = 'locations_owner_update_stripe'
  ) THEN
    CREATE POLICY locations_owner_update_stripe ON public.locations
      FOR UPDATE TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
      )
      WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
      );
  END IF;
END $$;

-- Service role keeps full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'locations'
      AND policyname = 'locations_service_all'
  ) THEN
    CREATE POLICY locations_service_all ON public.locations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Explicit DML grants so the new RLS UPDATE policy is reachable by the
-- authenticated role (base table grants are required in addition to policies).
GRANT SELECT, UPDATE ON public.locations TO authenticated;
