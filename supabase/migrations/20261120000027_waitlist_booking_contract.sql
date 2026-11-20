BEGIN;
ALTER TABLE public.booking_waitlist ADD COLUMN claimed_booking_id uuid REFERENCES public.bookings(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.claim_waitlist_spot(p_waitlist_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_entry public.booking_waitlist%ROWTYPE;
  v_tenant uuid := (auth.jwt()->>'tenant_id')::uuid;
  v_created jsonb;
  v_booking uuid;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||v_tenant::text,0));
  SELECT w.* INTO v_entry FROM public.booking_waitlist w
    JOIN public.families f ON f.id=w.family_id AND f.tenant_id=w.tenant_id
    JOIN public.kids k ON k.id=w.kid_id AND k.family_id=f.id
    WHERE w.id=p_waitlist_id AND w.tenant_id=v_tenant AND f.parent_user_id=auth.uid() FOR UPDATE OF w;
  IF NOT FOUND THEN RETURN json_build_object('code','NOT_FOUND'); END IF;
  IF v_entry.status='claimed' AND v_entry.claimed_booking_id IS NOT NULL THEN
    RETURN json_build_object('code','OK','booking_id',v_entry.claimed_booking_id);
  END IF;
  IF v_entry.status<>'notified' THEN RETURN json_build_object('code','NOT_FOUND'); END IF;
  IF v_entry.claim_deadline IS NOT NULL AND now()>v_entry.claim_deadline THEN
    UPDATE public.booking_waitlist SET status='expired',updated_at=now() WHERE id=p_waitlist_id;
    RETURN json_build_object('code','CLAIM_EXPIRED');
  END IF;
  -- A claim is a normal credit-backed reservation, not a free booking or a
  -- privileged INSERT. Resource/capacity failures leave the offer unclaimed.
  v_created := public.create_customer_booking(v_entry.kid_id,v_entry.location_id,v_entry.session_type_id,
    v_entry.scheduled_start,v_entry.id,v_entry.coach_id);
  v_booking := (v_created->'booking'->>'id')::uuid;
  UPDATE public.booking_waitlist SET status='claimed',claimed_booking_id=v_booking,updated_at=now() WHERE id=p_waitlist_id;
  RETURN json_build_object('code','OK','booking_id',v_booking);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_waitlist_spot(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_spot(uuid) TO authenticated;
COMMIT;
