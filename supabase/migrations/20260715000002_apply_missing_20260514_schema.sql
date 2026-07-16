-- =============================================================================
-- Apply missing pieces from 20260514000003_super_admin.sql
--
-- That migration was never applied to the live database, leaving:
--   • locations.is_active column missing  → API insert fails with schema cache error
--   • Super admin cross-tenant RLS bypass policies missing → HQ queries may fail
--   • anon grants on locations/tenants potentially incomplete
--
-- Everything here is idempotent: ADD COLUMN IF NOT EXISTS, DO blocks with
-- EXCEPTION WHEN duplicate_object THEN NULL for all policy creates.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. locations.is_active — the immediate blocker
-- ---------------------------------------------------------------------------
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;


-- ---------------------------------------------------------------------------
-- 2. Super admin cross-tenant RLS bypass policies
--    All wrapped in DO blocks so re-running is safe.
-- ---------------------------------------------------------------------------

-- tenants
DO $$ BEGIN
  CREATE POLICY tenants_select_super_admin ON public.tenants
    FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenants_insert_super_admin ON public.tenants
    FOR INSERT TO authenticated
    WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenants_update_super_admin ON public.tenants
    FOR UPDATE TO authenticated
    USING  ((auth.jwt() ->> 'app_role') = 'super_admin')
    WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- locations
DO $$ BEGIN
  CREATE POLICY locations_select_super_admin ON public.locations
    FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY locations_insert_super_admin ON public.locations
    FOR INSERT TO authenticated
    WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY locations_update_super_admin ON public.locations
    FOR UPDATE TO authenticated
    USING  ((auth.jwt() ->> 'app_role') = 'super_admin')
    WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- families
DO $$ BEGIN
  CREATE POLICY families_select_super_admin ON public.families
    FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- coaches
DO $$ BEGIN
  CREATE POLICY coaches_select_super_admin ON public.coaches
    FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- memberships (guard: table may not exist in all envs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'memberships'
  ) THEN
    BEGIN
      EXECUTE $p$
        CREATE POLICY memberships_select_super_admin ON public.memberships
          FOR SELECT TO authenticated
          USING ((auth.jwt() ->> 'app_role') = 'super_admin')
      $p$;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- payment_events (guard: table may not exist in all envs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_events'
  ) THEN
    BEGIN
      EXECUTE $p$
        CREATE POLICY payment_events_select_super_admin ON public.payment_events
          FOR SELECT TO authenticated
          USING ((auth.jwt() ->> 'app_role') = 'super_admin')
      $p$;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 3. Grants — idempotent; safe to re-run
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.super_admins TO authenticated;
GRANT SELECT ON public.locations TO anon;
GRANT SELECT (id, name, slug) ON public.tenants TO anon;


-- ---------------------------------------------------------------------------
-- 4. Reload PostgREST schema cache so the new column is visible immediately
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
