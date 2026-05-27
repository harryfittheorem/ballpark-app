-- =============================================================================
-- Task #428 — Sync sessions_per_week from plan to membership on enrolment
--
-- Adds a BEFORE INSERT trigger on memberships that automatically copies
-- sessions_per_week (and initialises weekly_period_start to the current
-- Monday) from the matching membership_plans row whenever a new EFT membership
-- is created with a NULL sessions_per_week.
--
-- This is defence-in-depth on top of the application-layer copy already
-- present in the enrolment API route — it guarantees the field is always
-- populated for any INSERT path (API, scripts, direct SQL, future code).
--
-- Plan lookup intentionally omits is_active so that memberships referencing
-- since-deactivated plans are still correctly seeded. If multiple plans share
-- the same (tenant_id, plan_type, name) the one most recently updated wins.
--
-- Also backfills active/pending/paused EFT memberships still missing the
-- value (idempotent — safe to run multiple times).
-- =============================================================================

-- ── 1. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sync_membership_sessions_per_week()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spw integer;
BEGIN
  -- Only act on EFT rows where the caller did not already supply a value.
  IF NEW.plan_type <> 'eft' OR NEW.sessions_per_week IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the plan by (tenant_id, plan_type, plan_name) — the three
  -- denormalised keys stored on every membership at creation time.
  -- No is_active filter: memberships may reference plans that were later
  -- deactivated. Most-recently-updated plan wins when names collide.
  SELECT sessions_per_week
  INTO   v_spw
  FROM   public.membership_plans
  WHERE  tenant_id         = NEW.tenant_id
    AND  plan_type         = 'eft'
    AND  name              = NEW.plan_name
    AND  sessions_per_week IS NOT NULL
  ORDER BY updated_at DESC NULLS LAST
  LIMIT  1;

  IF v_spw IS NOT NULL THEN
    NEW.sessions_per_week   := v_spw;
    -- Default weekly_period_start to this week's Monday.
    NEW.weekly_period_start := COALESCE(
      NEW.weekly_period_start,
      date_trunc('week', current_date)::date
    );
    -- Ensure the rolling counter starts at zero.
    NEW.weekly_sessions_used := COALESCE(NEW.weekly_sessions_used, 0);
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Attach trigger to memberships ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_membership_sessions_per_week
  ON public.memberships;

CREATE TRIGGER trg_sync_membership_sessions_per_week
  BEFORE INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_membership_sessions_per_week();

-- ── 3. Backfill — EFT memberships still missing sessions_per_week ────────────
-- Covers active, pending, and paused statuses.
-- Omits is_active so archived plans can still seed their memberships.
-- Uses a lateral subquery for deterministic plan selection (most-recently-
-- updated plan wins when names collide within the same tenant).
UPDATE public.memberships m
SET    sessions_per_week   = best_plan.sessions_per_week,
       weekly_period_start = COALESCE(
                               m.weekly_period_start,
                               date_trunc('week', current_date)::date
                             ),
       weekly_sessions_used = COALESCE(m.weekly_sessions_used, 0)
FROM (
  SELECT DISTINCT ON (m2.id)
         m2.id             AS membership_id,
         mp.sessions_per_week
  FROM   public.memberships m2
  JOIN   public.membership_plans mp
         ON  mp.tenant_id         = m2.tenant_id
         AND mp.plan_type         = 'eft'
         AND mp.name              = m2.plan_name
         AND mp.sessions_per_week IS NOT NULL
  WHERE  m2.plan_type         = 'eft'
    AND  m2.status            IN ('active', 'pending', 'paused')
    AND  m2.sessions_per_week IS NULL
  ORDER BY m2.id, mp.updated_at DESC NULLS LAST
) best_plan
WHERE  m.id = best_plan.membership_id;
