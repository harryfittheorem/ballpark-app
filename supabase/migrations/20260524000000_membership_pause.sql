-- ============================================================
-- Task #240: Membership pause flow
-- Adds pause columns to memberships, a parent SELECT policy,
-- and SECURITY DEFINER RPCs for pause / resume.
-- ============================================================

-- ── Pause columns ───────────────────────────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS pause_start  date,
  ADD COLUMN IF NOT EXISTS pause_end    date,
  ADD COLUMN IF NOT EXISTS paused_at    timestamptz;

CREATE INDEX IF NOT EXISTS memberships_pause_end_idx
  ON public.memberships (pause_end)
  WHERE status = 'paused';

-- ── Parent can read their own family's memberships ──────────
-- (Used by the mobile app useMembership hook.)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'memberships'
      AND policyname = 'memberships_parent_select'
  ) THEN
    CREATE POLICY memberships_parent_select ON public.memberships
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'app_role') = 'parent'
        AND family_id IN (
          SELECT id FROM public.families
          WHERE parent_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── pause_membership RPC ────────────────────────────────────
-- Derives caller identity from auth.jwt() / auth.uid() — never from
-- caller-supplied parameters. Granted only to 'authenticated'.
--
-- Validates:
--   1. Caller is 'parent' (own family) or 'owner'/'admin' (same tenant)
--   2. EFT membership, active status, 7–90 day window
--   3. No other membership in same family currently paused (overlap guard)
CREATE OR REPLACE FUNCTION public.pause_membership(
  p_membership_id uuid,
  p_pause_end     date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   text;
  v_caller_id     uuid;
  v_caller_tenant text;
  v_mem           record;
  v_today         date := current_date;
  v_overlap_count int;
BEGIN
  -- Derive caller identity from JWT (never trust caller-supplied params)
  v_caller_role   := auth.jwt() ->> 'app_role';
  v_caller_id     := auth.uid();
  v_caller_tenant := auth.jwt() ->> 'tenant_id';

  IF v_caller_role IS NULL OR v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthorized');
  END IF;

  -- Only parents and owners/admins can pause memberships
  IF v_caller_role NOT IN ('parent', 'owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  -- Load membership row
  SELECT m.id, m.plan_type, m.status, m.tenant_id, m.family_id, f.parent_user_id
    INTO v_mem
    FROM public.memberships m
    JOIN public.families    f ON f.id = m.family_id
   WHERE m.id = p_membership_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Scope enforcement
  IF v_caller_role = 'parent' THEN
    IF v_mem.parent_user_id <> v_caller_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  ELSE
    -- owner / admin must be in the same tenant
    IF v_caller_tenant IS NULL OR v_mem.tenant_id::text <> v_caller_tenant THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  END IF;

  -- Business rule validations
  IF v_mem.plan_type <> 'eft' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eft');
  END IF;
  IF v_mem.status = 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_paused');
  END IF;
  IF v_mem.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_active');
  END IF;
  IF p_pause_end < v_today + 7 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pause_too_short');
  END IF;
  IF p_pause_end > v_today + 90 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pause_too_long');
  END IF;

  -- Family-level overlap prevention:
  -- Reject if any OTHER membership in the same family is currently paused.
  SELECT COUNT(*)
    INTO v_overlap_count
    FROM public.memberships
   WHERE family_id = v_mem.family_id
     AND id       <> p_membership_id
     AND status    = 'paused'
     AND pause_end >= v_today;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'family_already_paused');
  END IF;

  -- Apply pause
  UPDATE public.memberships
     SET status      = 'paused',
         pause_start = v_today,
         pause_end   = p_pause_end,
         paused_at   = now(),
         updated_at  = now()
   WHERE id = p_membership_id;

  RETURN jsonb_build_object('ok', true, 'pause_start', v_today, 'pause_end', p_pause_end);
END;
$$;

-- Only authenticated users may call this RPC; internal auth derived from JWT.
REVOKE ALL ON FUNCTION public.pause_membership(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pause_membership(uuid, date) TO authenticated;

-- ── resume_membership RPC ───────────────────────────────────
-- Same JWT-derived auth model. Callable by parents (own family) and
-- owners/admins (same tenant). The nightly cron uses a direct service-role
-- UPDATE instead of this RPC (see resume-paused-memberships edge function).
CREATE OR REPLACE FUNCTION public.resume_membership(
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   text;
  v_caller_id     uuid;
  v_caller_tenant text;
  v_mem           record;
BEGIN
  -- Derive caller identity from JWT
  v_caller_role   := auth.jwt() ->> 'app_role';
  v_caller_id     := auth.uid();
  v_caller_tenant := auth.jwt() ->> 'tenant_id';

  IF v_caller_role IS NULL OR v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthorized');
  END IF;

  IF v_caller_role NOT IN ('parent', 'owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT m.id, m.status, m.tenant_id, f.parent_user_id
    INTO v_mem
    FROM public.memberships m
    JOIN public.families    f ON f.id = m.family_id
   WHERE m.id = p_membership_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Scope enforcement
  IF v_caller_role = 'parent' THEN
    IF v_mem.parent_user_id <> v_caller_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  ELSE
    IF v_caller_tenant IS NULL OR v_mem.tenant_id::text <> v_caller_tenant THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
  END IF;

  IF v_mem.status <> 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_paused');
  END IF;

  UPDATE public.memberships
     SET status      = 'active',
         pause_start = NULL,
         pause_end   = NULL,
         paused_at   = NULL,
         updated_at  = now()
   WHERE id     = p_membership_id
     AND status = 'paused';  -- idempotency guard

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.resume_membership(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resume_membership(uuid) TO authenticated;

-- ── pg_cron: auto-resume schedule ───────────────────────────
-- Registers a daily job at 06:00 UTC that calls the
-- resume-paused-memberships Edge Function via pg_net.
--
-- Prerequisites (run once per environment, not in migration):
--   ALTER DATABASE postgres SET app.settings.supabase_url = '<url>';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<key>';
--   SELECT pg_reload_conf();
--
-- Idempotent: unschedule-then-schedule, skipped if pg_cron not installed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule('resume-paused-memberships-daily');
    PERFORM cron.schedule(
      'resume-paused-memberships-daily',
      '0 6 * * *',
      $cron$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url')
                     || '/functions/v1/resume-paused-memberships',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer '
              || current_setting('app.settings.service_role_key')
          ),
          body    := '{}'::jsonb
        );
      $cron$
    );
  END IF;
END $$;
