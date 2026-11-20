-- Bring-a-Friend retains its existing two-booking/two-credit transaction.
-- Each rental reservation needs its own exclusive eligible cage; no new
-- resource-sharing exception or entitlement policy is introduced.
BEGIN;
CREATE OR REPLACE FUNCTION public.require_booking_resource()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_category text;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.tenant_id,NEW.location_id,NEW.session_type_id,NEW.scheduled_start,NEW.scheduled_end,NEW.cage_number)
    IS NOT DISTINCT FROM ROW(OLD.tenant_id,OLD.location_id,OLD.session_type_id,OLD.scheduled_start,OLD.scheduled_end,OLD.cage_number)
    AND NOT (OLD.status IN ('cancelled','no_show') AND NEW.status NOT IN ('cancelled','no_show')) THEN RETURN NEW; END IF;
  IF NEW.status IN ('cancelled','no_show') THEN RETURN NEW; END IF;
  SELECT type_category INTO v_category FROM public.session_types WHERE id=NEW.session_type_id AND tenant_id=NEW.tenant_id;
  IF v_category='cage' AND NEW.cage_number IS NULL
    AND current_setting('app.booking_friend_resources',true)='on' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||NEW.tenant_id::text,0));
    SELECT r.cage_number INTO NEW.cage_number FROM public.scheduling_resources r
      WHERE r.tenant_id=NEW.tenant_id AND r.location_id=NEW.location_id AND r.is_active
        AND r.purpose IN ('rental','both')
        AND public.is_scheduling_resource_free(NEW.tenant_id,NEW.location_id,r.cage_number,
          NEW.scheduled_start,NEW.scheduled_end,NEW.id,NULL)
      ORDER BY r.cage_number LIMIT 1;
    IF NEW.cage_number IS NULL THEN RAISE EXCEPTION 'rental_resource_not_available'; END IF;
  END IF;
  IF v_category='cage' AND NEW.cage_number IS NULL THEN RAISE EXCEPTION 'rental_cage_required'; END IF;
  IF NEW.cage_number IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||NEW.tenant_id::text,0));
    IF NOT public.is_scheduling_resource_free(NEW.tenant_id,NEW.location_id,NEW.cage_number,
      NEW.scheduled_start,NEW.scheduled_end,NEW.id,NULL) THEN RAISE EXCEPTION 'resource_not_available'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_booking_resource() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.book_session_with_friend(
  p_tenant_id uuid,p_location_id uuid,p_kid_id uuid,p_coach_id uuid,p_session_type_id uuid,
  p_scheduled_start timestamptz,p_scheduled_end timestamptz,p_guest_name text,
  p_guest_phone text DEFAULT NULL,p_guest_email text DEFAULT NULL,p_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_payload jsonb := jsonb_build_array('friend',p_location_id,p_kid_id,p_coach_id,p_session_type_id,
    p_scheduled_start,p_scheduled_end,p_guest_name,p_guest_phone,p_guest_email);
  v_key uuid;
  v_receipt public.booking_friend_requests%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM (auth.jwt()->>'tenant_id')::uuid THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids k JOIN public.families f ON f.id=k.family_id
    WHERE k.id=p_kid_id AND f.tenant_id=p_tenant_id AND f.parent_user_id=auth.uid()) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||p_tenant_id::text,0));
  v_key := COALESCE(p_request_id,md5(v_payload::text)::uuid);
  SELECT * INTO v_receipt FROM public.booking_friend_requests WHERE tenant_id=p_tenant_id AND actor_id=auth.uid() AND request_id=v_key;
  IF FOUND THEN
    IF v_receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
    RETURN v_receipt.result;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.session_types WHERE id=p_session_type_id AND tenant_id=p_tenant_id
    AND is_active AND type_category IN ('private','cage')) THEN
    RAISE EXCEPTION 'event_or_appointment_workflow_required';
  END IF;
  -- Only this already-authorized, transaction-scoped legacy pair operation may
  -- auto-fill its two INSERTs. Direct client INSERT is revoked, the internal
  -- function is private, and ordinary staff rentals still require a selection.
  PERFORM set_config('app.booking_friend_resources','on',true);
  v_result := public.book_session_with_friend_internal(p_tenant_id,p_location_id,p_kid_id,p_coach_id,p_session_type_id,
    p_scheduled_start,p_scheduled_end,p_guest_name,p_guest_phone,p_guest_email);
  PERFORM set_config('app.booking_friend_resources','off',true);
  INSERT INTO public.booking_friend_requests VALUES(p_tenant_id,auth.uid(),v_key,v_payload,v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.book_session_with_friend(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.book_session_with_friend(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,uuid) TO authenticated;
COMMIT;
