-- =============================================================================
-- Ballpark — Task #520: Re-wire pause/resume cron
-- =============================================================================
-- The original pause migration registered the pg_cron job using
-- current_setting('app.settings.supabase_url') WITHOUT the safe second
-- argument (true). If that GUC is unset the cron body throws a runtime error
-- instead of skipping gracefully, meaning pg_cron would log an error at 06:00
-- every day rather than being a quiet no-op.
--
-- This migration re-registers the job with:
--   current_setting('app.settings.supabase_url', true)
--   current_setting('app.settings.service_role_key', true)
-- and adds a WHERE guard identical to the cancellation cron so the http_post
-- only fires when both GUCs are non-null and non-empty.
--
-- Idempotent: unschedule is wrapped in EXCEPTION to tolerate missing job.
-- Safe to re-run: schedule replaces any existing job with the same name.
--
-- Prerequisites (one-time per environment):
--   ALTER DATABASE postgres SET "app.settings.supabase_url"     = '<url>';
--   ALTER DATABASE postgres SET "app.settings.service_role_key" = '<key>';
--   SELECT pg_reload_conf();
--
-- See docs/RUNBOOK.md and scripts/setup-cron-guc.mjs for full setup.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    -- Remove existing registration (any name) then re-add with safe GUC access.
    BEGIN
      PERFORM cron.unschedule('resume-paused-memberships-daily');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'resume-paused-memberships-daily',
      '0 6 * * *',
      $cron$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url', true)
                     || '/functions/v1/resume-paused-memberships',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer '
              || current_setting('app.settings.service_role_key', true)
          ),
          body    := '{}'::jsonb
        ) AS request_id
        WHERE current_setting('app.settings.supabase_url', true) IS NOT NULL
          AND current_setting('app.settings.supabase_url', true) <> ''
          AND current_setting('app.settings.service_role_key', true) IS NOT NULL
          AND current_setting('app.settings.service_role_key', true) <> '';
      $cron$
    );

  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron or pg_net not available — skip silently.
  NULL;
END;
$$;


-- =============================================================================
-- VALIDATION
-- =============================================================================
-- SELECT jobname, schedule, active FROM cron.job
--  WHERE jobname = 'resume-paused-memberships-daily';
-- Expected: 1 row, active = true, schedule = '0 6 * * *'
-- =============================================================================
