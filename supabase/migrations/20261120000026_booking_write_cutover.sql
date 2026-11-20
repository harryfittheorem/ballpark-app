BEGIN;
-- Updated mobile, public and portal clients use atomic creation RPCs. Keeping
-- direct INSERT available would allow a caller to omit the credit deduction.
-- Existing bookings are untouched; old mobile builds must upgrade explicitly.
REVOKE INSERT,UPDATE ON public.bookings FROM PUBLIC,anon,authenticated;

ALTER FUNCTION public.cancel_booking(uuid,text,boolean) RENAME TO cancel_booking_authorized_internal;
REVOKE ALL ON FUNCTION public.cancel_booking_authorized_internal(uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.cancel_booking(p_booking_id uuid,p_reason text DEFAULT NULL,p_override boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM set_config('app.booking_cancellation','on',true);
  v_result := public.cancel_booking_authorized_internal(p_booking_id,p_reason,p_override);
  PERFORM set_config('app.booking_cancellation','off',true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid,text,boolean) TO authenticated;

CREATE FUNCTION public.require_booking_cancellation_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status='cancelled' AND OLD.status IS DISTINCT FROM NEW.status
    AND auth.jwt()->>'role' IS DISTINCT FROM 'service_role'
    AND COALESCE(current_setting('app.booking_cancellation',true),'')<>'on'
    THEN RAISE EXCEPTION 'cancellation_rpc_required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER require_booking_cancellation_policy BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.require_booking_cancellation_policy();
REVOKE ALL ON FUNCTION public.require_booking_cancellation_policy() FROM PUBLIC,anon,authenticated;
COMMIT;
