-- =============================================================================
-- Migration: Register pg_cron job for enforce-payment-pause
-- =============================================================================
-- The enforce-payment-pause edge function runs daily at 08:00 UTC and pauses
-- any membership whose payment_pause_scheduled_at has passed.
-- Registered here so it survives DB resets and is idempotent via
-- cron.unschedule + cron.schedule.
-- =============================================================================

DO $$
BEGIN
  -- Remove stale registration if it already exists (idempotent)
  BEGIN
    PERFORM cron.unschedule('enforce-payment-pause');
  EXCEPTION WHEN others THEN
    NULL; -- job didn't exist, that's fine
  END;

  PERFORM cron.schedule(
    'enforce-payment-pause',
    '0 8 * * *',
    $cron$
      SELECT net.http_post(
        url     := current_setting('app.settings.supabase_url', true)
                     || '/functions/v1/enforce-payment-pause',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body    := '{}'::jsonb
      );
    $cron$
  );
  RAISE NOTICE 'enforce-payment-pause cron job registered (0 8 * * *)';
EXCEPTION WHEN others THEN
  RAISE NOTICE
    'enforce-payment-pause cron NOT registered (pg_cron unavailable or GUCs not set): %. '
    'Run: SELECT cron.schedule(...) once pg_cron is enabled.',
    SQLERRM;
END;
$$;
