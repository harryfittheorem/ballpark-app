-- =============================================================================
-- Ballpark — Task #234: Automated booking reminders (24h + 2h before session)
-- =============================================================================
-- Adds the `booking_reminder_log` idempotency table and two pg_cron jobs
-- that call the `send-booking-reminders` Edge Function every 30 minutes —
-- once for the 24-hour window and once for the 2-hour window.
--
-- Idempotency design:
--   UNIQUE (booking_id, reminder_type) — the Edge Function checks this table
--   before firing push + email, and inserts into it on success. A second run
--   of the cron within the same window hits the unique constraint and is a
--   true no-op (no push, no email, no second row).
--
-- pg_cron schedule:
--   Both jobs run every 30 minutes (*/30 * * * *). The Edge Function's query
--   windows are:
--     24h: scheduled_start BETWEEN now()+23h AND now()+25h
--      2h: scheduled_start BETWEEN now()+1h  AND now()+3h
--   A booking eligible in one run will always be covered again by the next run
--   30 minutes later — the UNIQUE constraint makes the second run a no-op.
--
-- pg_cron + pg_net are Supabase built-ins available on all projects.
-- The jobs depend on GUCs set once per env:
--   ALTER DATABASE postgres SET app.settings.supabase_url = '...';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '...';
--   SELECT pg_reload_conf();
-- The migration is written to tolerate those GUCs being absent (jobs are
-- registered but the http_post body will log an error from the Edge Function
-- until the GUCs are set).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. booking_reminder_log table
-- -----------------------------------------------------------------------------
CREATE TABLE public.booking_reminder_log (
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
reminder twice, regardless of how many times the cron fires within the
eligibility window.$c$;


-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_booking_reminder_log_booking_id ON public.booking_reminder_log(booking_id);
CREATE INDEX idx_booking_reminder_log_sent_at    ON public.booking_reminder_log(sent_at);


-- -----------------------------------------------------------------------------
-- 3. RLS — service-role only; no client access needed
-- -----------------------------------------------------------------------------
ALTER TABLE public.booking_reminder_log ENABLE ROW LEVEL SECURITY;

-- No authenticated-user policies. The Edge Function uses the service-role
-- client (bypasses RLS). The table is never exposed to the mobile client.

-- GRANTs so the service_role client can read/write from the Edge Function.
GRANT SELECT, INSERT ON public.booking_reminder_log TO service_role;


-- -----------------------------------------------------------------------------
-- 4. pg_cron — register two scheduled jobs
--    Requires `pg_cron` extension (enabled by default on Supabase).
--    The DO block uses IF NOT EXISTS style via unschedule+schedule to be
--    idempotent when the migration is replayed.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- 24h reminder job
  PERFORM cron.unschedule('booking-reminder-24h');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet; ignore
END;
$$;

SELECT cron.schedule(
  'booking-reminder-24h',
  '*/30 * * * *',
  $$
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
  $$
);

DO $$
BEGIN
  -- 2h reminder job
  PERFORM cron.unschedule('booking-reminder-2h');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'booking-reminder-2h',
  '*/30 * * * *',
  $$
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
  $$
);
