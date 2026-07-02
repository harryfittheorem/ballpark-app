-- =============================================================================
-- Ballpark — Task #519: Re-wire cancellation cron
-- =============================================================================
-- The initial cancellation_policy migration registered the pg_cron job with
-- cron.schedule() but without a preceding cron.unschedule(). This migration
-- re-registers it idempotently (unschedule-then-schedule) so that:
--   1. Any stale registration (e.g. from a run before GUCs were set) is replaced.
--   2. The job name is standardised to 'process-membership-cancellations-daily'
--      (the original used 'process-membership-cancellations' without '-daily').
--   3. The WHERE guard is preserved: the http_post is a no-op if GUCs are unset.
--
-- Prerequisites (one-time per environment, run via scripts/setup-cron-guc.mjs):
--   ALTER DATABASE postgres SET app.settings.supabase_url = '<url>';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<key>';
--   SELECT pg_reload_conf();
--
-- Safe to re-run: unschedule is wrapped in EXCEPTION to tolerate missing job.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    -- Remove both the old name (without -daily) and the new name, then re-add.
    BEGIN
      PERFORM cron.unschedule('process-membership-cancellations');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      PERFORM cron.unschedule('process-membership-cancellations-daily');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'process-membership-cancellations-daily',
      '0 2 * * *',
      $cron$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url', true)
                     || '/functions/v1/process-membership-cancellations',
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
--  WHERE jobname = 'process-membership-cancellations-daily';
-- Expected: 1 row, active = true, schedule = '0 2 * * *'
-- =============================================================================
