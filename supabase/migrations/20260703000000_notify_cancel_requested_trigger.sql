-- =============================================================================
-- Task #261 — Cancellation emails
--
-- Fires the notify-cancel-requested edge function via pg_net when a membership's
-- cancel_requested_at changes from NULL to a non-null value (i.e. when a parent
-- or owner requests a cancellation via the cancel_membership() RPC).
--
-- The trigger uses the same GUC guard pattern as achievement/waiver triggers:
-- it only fires if app.settings.supabase_url and app.settings.service_role_key
-- are configured. It is a no-op otherwise (safe for environments where the
-- settings are absent).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.after_membership_cancel_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url     text;
  v_key     text;
BEGIN
  -- Only fire when cancel_requested_at transitions from NULL → non-null
  IF NEW.cancel_requested_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.cancel_requested_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- GUC guard: only invoke if pg_net / URLs are configured
  v_url := current_setting('app.settings.supabase_url', true);
  v_key := current_setting('app.settings.service_role_key', true);

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-cancel-requested',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('membership_id', NEW.id::text)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cancel_requested ON public.memberships;

CREATE TRIGGER trg_notify_cancel_requested
  AFTER UPDATE OF cancel_requested_at ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.after_membership_cancel_requested();
