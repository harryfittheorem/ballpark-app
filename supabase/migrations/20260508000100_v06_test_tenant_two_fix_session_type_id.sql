-- v0.6 — Fix: 20260508000000 used session_types.id 0...0301, which collides
-- with Infinite Hitting's existing 'Private Lesson — 30 min' row. The
-- ON CONFLICT (id) DO NOTHING silently skipped the Tenant 2 insert. Re-insert
-- under a non-colliding id. Idempotent.

INSERT INTO public.session_types (
  id, tenant_id, name, type_category, duration_minutes, base_price_cents, is_active
)
VALUES (
  '00000000-0000-0000-0000-000000002301',
  '00000000-0000-0000-0000-000000000002',
  'Tenant 2 Test Session',
  'private',
  60,
  5000,
  true
)
ON CONFLICT (id) DO NOTHING;
