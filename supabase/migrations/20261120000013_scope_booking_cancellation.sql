BEGIN;

-- Retain the established cancellation-window, fee and audit behavior, but
-- close the tenant-wide staff bypass and parent-supplied override.
ALTER FUNCTION public.cancel_booking(uuid,text,boolean) RENAME TO cancel_booking_policy_internal;
REVOKE ALL ON FUNCTION public.cancel_booking_policy_internal(uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.cancel_booking(
  p_booking_id uuid,p_reason text DEFAULT NULL,p_override boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  b public.bookings%ROWTYPE;
  v_role text := COALESCE(auth.jwt()->>'app_role','');
  v_coach public.coaches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_role NOT IN ('owner','admin','super_admin','coach','parent') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id
    AND tenant_id=(auth.jwt()->>'tenant_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code','NOT_FOUND','message','Booking not found or access denied'); END IF;
  IF v_role='parent' THEN
    IF p_override THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    -- Family ownership is checked again by the existing policy function.
  ELSE
    IF NOT COALESCE(public.can_manage_booking_location(b.tenant_id,b.location_id),false) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
    IF v_role='coach' THEN
      SELECT * INTO v_coach FROM public.coaches WHERE user_id=auth.uid() AND tenant_id=b.tenant_id AND is_active;
      IF v_coach.id IS NULL OR (v_coach.capabilities->>'preset' IS DISTINCT FROM 'staff'
        AND b.coach_id IS DISTINCT FROM v_coach.id AND b.actual_coach_id IS DISTINCT FROM v_coach.id) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
      END IF;
    END IF;
  END IF;
  RETURN public.cancel_booking_policy_internal(p_booking_id,p_reason,p_override);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid,text,boolean) TO authenticated;

COMMIT;
