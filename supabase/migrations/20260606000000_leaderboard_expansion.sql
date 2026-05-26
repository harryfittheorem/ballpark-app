-- =============================================================================
-- Ballpark — Leaderboard expansion: HitTrax all-time records + lesson count
-- =============================================================================
-- 1. Update kids.age_group check constraint to the new age-group taxonomy
--    (8U / 10U / 12U / 14U / HS / College).  Existing rows with old values
--    (9U, 11U, 13U, 15U+) are NULLed before the new constraint is added so
--    the migration never rejects pre-existing data.
--
-- 2. Add get_hittrax_leaderboard(p_metric, p_scope, p_location_id, p_age_group)
--    SECURITY DEFINER RPC — returns top 50 kids by their personal best for the
--    requested metric, optionally scoped to an age group and/or location.
--    Tenant-pins via JWT tenant_id claim.
--
-- 3. Add get_lesson_count_leaderboard(p_location_id)
--    SECURITY DEFINER RPC — returns top 50 active members ranked by count of
--    completed bookings at the requested location.
--    Tenant-pins via JWT tenant_id claim.
--
-- Both RPCs are callable by any authenticated tenant member (parent + coach).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Update age_group check constraint
-- -----------------------------------------------------------------------------

-- Null out any existing rows whose values are no longer valid.
UPDATE public.kids
   SET age_group = NULL
 WHERE age_group IS NOT NULL
   AND age_group NOT IN ('8U','10U','12U','14U','HS','College');

-- Drop the old check constraint (name from initial schema).
ALTER TABLE public.kids
  DROP CONSTRAINT IF EXISTS kids_age_group_check;

-- Add the new constraint.
ALTER TABLE public.kids
  ADD CONSTRAINT kids_age_group_check
    CHECK (age_group IS NULL OR age_group IN ('8U','10U','12U','14U','HS','College'));


-- -----------------------------------------------------------------------------
-- 2. RPC: get_hittrax_leaderboard
-- -----------------------------------------------------------------------------
-- Parameters:
--   p_metric      TEXT   — 'exit_velocity_mph' | 'distance_ft' (required)
--   p_scope       TEXT   — 'national' | 'clubhouse' (default 'national')
--   p_location_id uuid   — required when p_scope = 'clubhouse'; ignored otherwise
--   p_age_group   TEXT   — optional; NULL = all age groups; 'unranked' = kids with age_group IS NULL
--
-- Returns: top 50 rows, ordered by value DESC.
--   national scope  → all locations in this tenant
--   clubhouse scope → only kids whose family.primary_location_id = p_location_id
--
-- RLS: caller must be authenticated in the right tenant. The function derives
-- tenant_id from auth.jwt() and never trusts the caller to supply it.
--
-- Note on clubhouse scope: home location lives on families.primary_location_id
-- (not kids), so the clubhouse filter does a JOIN to families. The SECURITY
-- DEFINER context allows this join without a separate RLS policy on families.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hittrax_leaderboard(
  p_metric      text,
  p_scope       text    DEFAULT 'national',
  p_location_id uuid    DEFAULT NULL,
  p_age_group   text    DEFAULT NULL
)
RETURNS TABLE (
  kid_id     uuid,
  first_name text,
  last_name  text,
  age_group  text,
  value      numeric,
  rank       bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Tenant guard.
  v_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'get_hittrax_leaderboard: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  -- Validate metric.
  IF p_metric NOT IN ('exit_velocity_mph', 'distance_ft') THEN
    RAISE EXCEPTION 'get_hittrax_leaderboard: unsupported metric %', p_metric USING ERRCODE = '22023';
  END IF;

  -- Validate scope.
  IF p_scope NOT IN ('national', 'clubhouse') THEN
    RAISE EXCEPTION 'get_hittrax_leaderboard: unsupported scope %', p_scope USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      k.id                                                          AS kid_id,
      k.first_name,
      k.last_name,
      k.age_group,
      pb.value,
      RANK() OVER (ORDER BY pb.value DESC)                          AS rank
    FROM public.personal_bests pb
    JOIN public.kids k
      ON k.id = pb.kid_id
    -- Clubhouse scope: filter via families.primary_location_id (location lives
    -- on the family row, not the kid row).
    LEFT JOIN public.families f
      ON f.id = k.family_id
    WHERE pb.tenant_id  = v_tenant_id
      AND pb.metric     = p_metric
      -- Age-group filter:
      --   NULL          → all groups (ranked + unranked)
      --   'unranked'    → only kids with no age_group set
      --   anything else → exact match
      AND (
        p_age_group IS NULL
        OR (p_age_group = 'unranked' AND k.age_group IS NULL)
        OR (p_age_group <> 'unranked' AND k.age_group = p_age_group)
      )
      -- Scope filter: clubhouse uses families.primary_location_id.
      AND (
        p_scope = 'national'
        OR (
          p_scope = 'clubhouse'
          AND p_location_id IS NOT NULL
          AND f.primary_location_id = p_location_id
        )
      )
  )
  SELECT r.kid_id, r.first_name, r.last_name, r.age_group, r.value, r.rank
    FROM ranked r
   -- Clubhouse: top 10 athletes per location.
   -- National:  top 40 athletes across all locations.
   WHERE r.rank <= CASE WHEN p_scope = 'clubhouse' THEN 10 ELSE 40 END
   ORDER BY r.rank, r.first_name;
END;
$$;

ALTER FUNCTION public.get_hittrax_leaderboard(text, text, uuid, text) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.get_hittrax_leaderboard(text, text, uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_hittrax_leaderboard(text, text, uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. RPC: get_lesson_count_leaderboard
-- -----------------------------------------------------------------------------
-- Returns the top 50 kids (with active memberships) ranked by total completed
-- bookings at the given location. Tenant-pinned via JWT.
--
-- Parameters:
--   p_location_id uuid — filter to bookings at this location (required)
--
-- A kid is included when they have at least 1 completed booking at the location
-- AND an active membership in the tenant (status = 'active').
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lesson_count_leaderboard(
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  kid_id       uuid,
  first_name   text,
  last_name    text,
  lesson_count bigint,
  rank         bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'get_lesson_count_leaderboard: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  WITH lesson_counts AS (
    SELECT
      b.kid_id,
      COUNT(*)::bigint AS lesson_count
    FROM public.bookings b
    JOIN public.memberships m
      ON m.kid_id    = b.kid_id
     AND m.tenant_id = v_tenant_id
     AND m.status    = 'active'
    WHERE b.tenant_id  = v_tenant_id
      AND b.status     = 'completed'
      AND (p_location_id IS NULL OR b.location_id = p_location_id)
    GROUP BY b.kid_id
  ),
  ranked AS (
    SELECT
      lc.kid_id,
      k.first_name,
      k.last_name,
      lc.lesson_count,
      RANK() OVER (ORDER BY lc.lesson_count DESC) AS rank
    FROM lesson_counts lc
    JOIN public.kids k ON k.id = lc.kid_id
  )
  SELECT r.kid_id, r.first_name, r.last_name, r.lesson_count, r.rank
    FROM ranked r
   -- Location-scoped (clubhouse): top 10.
   -- All locations (national): top 40.
   WHERE r.rank <= CASE WHEN p_location_id IS NOT NULL THEN 10 ELSE 40 END
   ORDER BY r.rank, r.first_name;
END;
$$;

ALTER FUNCTION public.get_lesson_count_leaderboard(uuid) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.get_lesson_count_leaderboard(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_lesson_count_leaderboard(uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. Supporting index — personal_bests lookup for leaderboard queries
-- -----------------------------------------------------------------------------
-- The leaderboard query hits personal_bests filtered by (tenant_id, metric),
-- joined to kids. The existing idx_personal_bests_tenant_id covers tenant scans;
-- this composite index makes the (tenant_id, metric) filter selective.
CREATE INDEX IF NOT EXISTS idx_personal_bests_tenant_metric
  ON public.personal_bests (tenant_id, metric);
