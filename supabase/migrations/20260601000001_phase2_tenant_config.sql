-- =============================================================================
-- Ballpark — Phase 2, Step 2: tenant_config table
-- =============================================================================
-- Per-tenant feature flags and configuration values that are too volatile
-- or too tenant-specific for a migration to hard-code.
--
-- Starting with: allow_cross_location_booking (used by the booking trigger
-- in step 3 and the Book tab location selector in the mobile app).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.tenant_config (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  allow_cross_location_booking  boolean     NOT NULL DEFAULT false,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tenant_config_updated_at
  BEFORE UPDATE ON public.tenant_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_tenant_config_tenant_id ON public.tenant_config(tenant_id);


-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users in a tenant may read their config (needed by the
-- mobile app to conditionally show the cross-location picker).
CREATE POLICY tenant_config_select_own ON public.tenant_config
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Anon users may also read config so unauthenticated signup screens
-- can gate location picker behaviour before login.
CREATE POLICY tenant_config_select_anon ON public.tenant_config
  FOR SELECT TO anon
  USING (true);

-- Owners may update their own tenant config.
CREATE POLICY tenant_config_update_owner ON public.tenant_config
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Super admins: full cross-tenant access.
CREATE POLICY tenant_config_super_admin ON public.tenant_config
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'super_admin');


-- -----------------------------------------------------------------------------
-- 3. Grants
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.tenant_config TO anon;
GRANT SELECT, UPDATE ON public.tenant_config TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. Seed: one row per existing tenant, cross-location booking OFF by default.
--    ON CONFLICT makes this safe to re-run.
-- -----------------------------------------------------------------------------
INSERT INTO public.tenant_config (tenant_id, allow_cross_location_booking)
SELECT id, false
  FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;


-- =============================================================================
-- VALIDATION QUERIES
-- =============================================================================
-- SELECT tc.tenant_id, t.slug, tc.allow_cross_location_booking
--   FROM public.tenant_config tc
--   JOIN public.tenants t ON t.id = tc.tenant_id;
-- Expected: one row per tenant, allow_cross_location_booking = false.
-- =============================================================================
