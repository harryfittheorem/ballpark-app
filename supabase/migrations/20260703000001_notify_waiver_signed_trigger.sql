-- =============================================================================
-- Task #250 — Waiver signed email
--
-- Fires the notify-waiver-signed edge function via pg_net on every INSERT into
-- family_waivers, sending the parent a copy of the signed waiver by email.
--
-- Uses the same GUC guard pattern as other notification triggers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.after_family_waiver_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  v_key := current_setting('app.settings.service_role_key', true);

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-waiver-signed',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('family_waiver_id', NEW.id::text)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_waiver_signed ON public.family_waivers;

CREATE TRIGGER trg_notify_waiver_signed
  AFTER INSERT ON public.family_waivers
  FOR EACH ROW
  EXECUTE FUNCTION public.after_family_waiver_signed();
