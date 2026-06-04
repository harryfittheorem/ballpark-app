-- =============================================================================
-- 20260607000000_membership_upgrade.sql
-- Task #371 — Membership page: email CTA, view contract link, upgrade flow
--
-- 1. Add contract_url to memberships
-- 2. Add contact_email to tenants (used by request-membership-upgrade fn)
-- 3. Create membership_plans table with RLS + seed for infinitehitting
-- 4. Create membership_upgrade_requests table with RLS
--
-- Made idempotent: DROP POLICY IF EXISTS before each CREATE POLICY so this
-- can be re-applied even if some objects already exist in production.
-- =============================================================================

-- ── 1. memberships.contract_url ───────────────────────────────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS contract_url text;

-- ── 2. tenants.contact_email ──────────────────────────────────────────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS contact_email text;

UPDATE public.tenants
SET contact_email = 'info@infinitehitting.com'
WHERE slug = 'infinitehitting'
  AND contact_email IS NULL;

-- ── 3. membership_plans ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  plan_type    text        NOT NULL CHECK (plan_type IN ('eft', 'otc')),
  amount_cents integer     NOT NULL CHECK (amount_cents >= 0),
  description  text,
  sort_order   integer     NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_active_plans" ON public.membership_plans;
CREATE POLICY "members_select_active_plans"
  ON public.membership_plans
  FOR SELECT
  USING (
    is_active = true
    AND tenant_id = (
      SELECT t.id FROM public.tenants t
      WHERE t.id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

DROP POLICY IF EXISTS "admins_all_plans" ON public.membership_plans;
CREATE POLICY "admins_all_plans"
  ON public.membership_plans
  FOR ALL
  USING (
    (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

GRANT SELECT ON public.membership_plans TO authenticated;
GRANT ALL    ON public.membership_plans TO service_role;

-- Seed two example plans for infinitehitting
INSERT INTO public.membership_plans (id, tenant_id, name, plan_type, amount_cents, description, sort_order, is_active)
SELECT
  '71500000-0000-0000-0000-000000000000'::uuid,
  t.id,
  'Pro Hitter — 2× / Week',
  'eft',
  14900,
  'Two private lessons per month plus unlimited cage access.',
  10,
  true
FROM public.tenants t WHERE t.slug = 'infinitehitting'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.membership_plans (id, tenant_id, name, plan_type, amount_cents, description, sort_order, is_active)
SELECT
  '71500000-0000-0000-0000-000000000001'::uuid,
  t.id,
  'Elite — Unlimited',
  'eft',
  24900,
  'Unlimited private lessons, cage time, and HitTrax session access.',
  20,
  true
FROM public.tenants t WHERE t.slug = 'infinitehitting'
ON CONFLICT (id) DO NOTHING;

-- ── 4. membership_upgrade_requests ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.membership_upgrade_requests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  family_id         uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  membership_id     uuid        NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  requested_plan_id uuid        NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_upgrade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parents_insert_own_upgrade_requests" ON public.membership_upgrade_requests;
CREATE POLICY "parents_insert_own_upgrade_requests"
  ON public.membership_upgrade_requests
  FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT f.id FROM public.families f
      WHERE f.parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "parents_select_own_upgrade_requests" ON public.membership_upgrade_requests;
CREATE POLICY "parents_select_own_upgrade_requests"
  ON public.membership_upgrade_requests
  FOR SELECT
  USING (
    family_id IN (
      SELECT f.id FROM public.families f
      WHERE f.parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admins_all_upgrade_requests" ON public.membership_upgrade_requests;
CREATE POLICY "admins_all_upgrade_requests"
  ON public.membership_upgrade_requests
  FOR ALL
  USING (
    (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

GRANT SELECT, INSERT ON public.membership_upgrade_requests TO authenticated;
GRANT ALL            ON public.membership_upgrade_requests TO service_role;
