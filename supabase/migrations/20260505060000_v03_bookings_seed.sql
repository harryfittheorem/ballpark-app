-- =============================================================================
-- Ballpark — v0.3 Step 3.2: Bookings dev seed data
-- =============================================================================
-- Idempotent seed for the v0.3 Booking System so Phase B (`/src/api/bookings.ts`,
-- Book screen) has real rows to query without manual Studio entry.
--
-- Mirrors the v0.1 seed pattern: stable UUIDs in the `00000000-...` namespace
-- + `ON CONFLICT (id) DO NOTHING` so re-runs are no-ops.
--
-- UUID layout for this migration:
--   ...0201             -> Coach Mike (coaches.id)
--   ...0301..0304       -> session_types
--   ...0401..0403       -> coach_availability
--
-- Schema change: drop `coaches.user_id NOT NULL` so admin-provisioned ("ghost")
-- coaches can exist before a real auth user is linked. The UNIQUE constraint
-- stays. The JWT-hook lookup `coaches WHERE user_id = auth.uid() AND
-- is_active = true` is naturally safe — NULL never matches `auth.uid()`.
-- When Coach Mike eventually signs up, a follow-up migration will UPDATE
-- this row's `user_id` from NULL to the real auth.users.id.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Schema: allow NULL user_id on coaches (pre-provisioned coach rows)
-- -----------------------------------------------------------------------------
ALTER TABLE public.coaches
  ALTER COLUMN user_id DROP NOT NULL;


-- -----------------------------------------------------------------------------
-- 2. Seed: Coach Mike (Infinite Hitting / Dallas N.)
-- -----------------------------------------------------------------------------
INSERT INTO public.coaches (
  id,
  tenant_id,
  primary_location_id,
  user_id,
  first_name,
  last_name,
  specialty,
  bio,
  is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  NULL,
  'Mike',
  'Anderson',
  'Hitting Mechanics',
  'Former D1 hitter. 12 years coaching youth bat speed and contact quality.',
  true
)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 3. Seed: session_types catalogue (Infinite Hitting tenant)
-- -----------------------------------------------------------------------------
INSERT INTO public.session_types (
  id, tenant_id, name, type_category, duration_minutes, base_price_cents, description, is_active
)
VALUES
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'Private Lesson — 30 min',
    'private',
    30,
    4500,
    'One-on-one hitting instruction with a Pro Coach. Best for focused mechanics work.',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    'Private Lesson — 60 min',
    'private',
    60,
    8500,
    'One-on-one hitting instruction with a Pro Coach. Full session for swing rebuilds and game prep.',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000001',
    'Group Class',
    'group',
    60,
    3500,
    'Small-group hitting class (max 6 athletes). Drill-based, station rotation.',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000001',
    'Cage Rental',
    'cage',
    60,
    2500,
    'Self-directed batting cage time. No coach. Tee, soft-toss, or machine.',
    true
  )
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4. Seed: coach_availability for Coach Mike (Tue / Thu / Sat mornings)
--
--    day_of_week convention: 0 = Sunday … 6 = Saturday
--    Tuesday = 2, Thursday = 4, Saturday = 6
--    All times stored as `time` (no tz). Display layer converts via
--    locations.timezone (America/Chicago for Dallas N.).
-- -----------------------------------------------------------------------------
INSERT INTO public.coach_availability (
  id, tenant_id, coach_id, location_id, day_of_week,
  start_time, end_time, is_recurring, effective_from, effective_until
)
VALUES
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    2,
    '09:00'::time, '12:00'::time,
    true, CURRENT_DATE, NULL
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    4,
    '09:00'::time, '12:00'::time,
    true, CURRENT_DATE, NULL
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    6,
    '09:00'::time, '12:00'::time,
    true, CURRENT_DATE, NULL
  )
ON CONFLICT (id) DO NOTHING;
