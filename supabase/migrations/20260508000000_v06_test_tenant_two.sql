-- v0.6 — Seed a second tenant for tenant-isolation verification (dev-only).
-- Idempotent: every INSERT is keyed by a fixed UUID with ON CONFLICT (id) DO NOTHING.
-- No existing rows are modified.

-- 1. Tenant ------------------------------------------------------------------
INSERT INTO public.tenants (id, name, slug, brand_colors)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Test Tenant Two',
  'test-tenant-two',
  jsonb_build_object(
    'dark',     '#1F2937',
    'darker',   '#111827',
    'gold',     '#60A5FA',
    'goldDeep', '#2563EB',
    'cream',    '#F8FAFC'
  )
)
ON CONFLICT (id) DO NOTHING;

-- 2. Location ----------------------------------------------------------------
INSERT INTO public.locations (id, tenant_id, name, city, state, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000002',
  'Test Location',
  'Austin',
  'TX',
  'America/Chicago'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Session type ------------------------------------------------------------
-- session_types is tenant-scoped (no location_id column). type_category is
-- required; 'private' is the simplest valid value for an isolation smoke test.
INSERT INTO public.session_types (
  id, tenant_id, name, type_category, duration_minutes, base_price_cents, is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000002',
  'Tenant 2 Test Session',
  'private',
  60,
  5000,
  true
)
ON CONFLICT (id) DO NOTHING;
