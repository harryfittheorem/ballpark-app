-- ============================================================
-- Task #160 fix: least-privilege RLS correction.
--
-- Drops the over-privileged memberships_admin_all /
-- payment_events_admin_all (FOR ALL) policies created in
-- migration 000003 and replaces them with SELECT-only policies
-- for admin+owner.  Write access on these billing tables is
-- handled exclusively by service_role Edge Functions and the
-- existing memberships_service_all / payment_events_service_all
-- policies created in 000002.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- memberships: drop FOR ALL, create SELECT-only for admin/owner
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_admin_all'
  ) THEN
    DROP POLICY memberships_admin_all ON public.memberships;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_admin_select'
  ) THEN
    CREATE POLICY memberships_admin_select ON public.memberships
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('admin','owner')
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- payment_events: drop FOR ALL, create SELECT-only for admin/owner
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='payment_events' AND policyname='payment_events_admin_all'
  ) THEN
    DROP POLICY payment_events_admin_all ON public.payment_events;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='payment_events' AND policyname='payment_events_admin_select'
  ) THEN
    CREATE POLICY payment_events_admin_select ON public.payment_events
      FOR SELECT TO authenticated
      USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('admin','owner')
      );
  END IF;
END $$;
