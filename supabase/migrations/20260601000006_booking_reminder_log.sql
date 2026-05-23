-- =============================================================================
-- Ballpark — Task #234: Automated booking reminders (24h + 2h before session)
-- =============================================================================
-- Adds the `booking_reminder_log` idempotency table and two pg_cron jobs
-- that call the `send-booking-reminders` Edge Function every 30 minutes.
--
-- pg_cron is a Supabase built-in on Pro plans. The cron.schedule() calls
-- are wrapped in a DO block that checks for the extension first so the
-- migration is safe to apply on projects where pg_cron is not yet enabled.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. booking_reminder_log table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_reminder_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reminder_type   text        NOT NULL CHECK (reminder_type IN ('24h', '2h')),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_reminder_log_uniq UNIQUE (booking_id, reminder_type)
);

COMMENT ON TABLE public.booking_reminder_log IS
$c$One row per (booking, reminder_type) — the idempotency gate for the
send-booking-reminders Edge Function. The unique constraint on
(booking_id, reminder_type) ensures a booking never receives the same
reminder twice, regardless of how many times the cron fires.$c$;


-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_booking_reminder_log_booking_id ON public.booking_reminder_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reminder_log_sent_at    ON public.booking_reminder_log(sent_at);


-- -----------------------------------------------------------------------------
-- 3. RLS — service-role only; no client access needed
-- -----------------------------------------------------------------------------
ALTER TABLE public.booking_reminder_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.booking_reminder_log TO service_role;


-- -----------------------------------------------------------------------------
-- 4. pg_cron jobs — only registered when the extension is present.
--    Uses $job$ as the inner dollar-quote to avoid conflicts with the
--    outer DO $$ block delimiter.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_sql_24h text;
  v_sql_2h  text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping booking reminder cron jobs';
    RETURN;
  END IF;

  -- Unschedule existing jobs (ignore error if they do not exist yet)
  BEGIN
    PERFORM cron.unschedule('booking-reminder-24h');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('booking-reminder-2h');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_sql_24h := $job$
    SELECT net.http_post(
      url     := current_setting('app.settings.supabase_url', true)
                   || '/functions/v1/send-booking-reminders',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer '
                     || current_setting('app.settings.service_role_key', true)
                 ),
      body    := '{"reminder_type":"24h"}'::jsonb
    ) AS request_id;
  $job$;

  v_sql_2h := $job$
    SELECT net.http_post(
      url     := current_setting('app.settings.supabase_url', true)
                   || '/functions/v1/send-booking-reminders',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer '
                     || current_setting('app.settings.service_role_key', true)
                 ),
      body    := '{"reminder_type":"2h"}'::jsonb
    ) AS request_id;
  $job$;

  PERFORM cron.schedule('booking-reminder-24h', '*/30 * * * *', v_sql_24h);
  PERFORM cron.schedule('booking-reminder-2h',  '*/30 * * * *', v_sql_2h);

  RAISE NOTICE 'pg_cron: booking-reminder-24h and booking-reminder-2h scheduled';
END;
$$;
