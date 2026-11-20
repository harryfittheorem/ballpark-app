BEGIN;

CREATE TABLE public.booking_friend_requests (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY(tenant_id,actor_id,request_id)
);
ALTER TABLE public.booking_friend_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_friend_requests FROM anon,authenticated;
GRANT ALL ON public.booking_friend_requests TO service_role;

ALTER FUNCTION public.book_session_with_friend(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text)
  RENAME TO book_session_with_friend_internal;
REVOKE ALL ON FUNCTION public.book_session_with_friend_internal(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.book_session_with_friend(
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
  v_result := public.book_session_with_friend_internal(p_tenant_id,p_location_id,p_kid_id,p_coach_id,p_session_type_id,
    p_scheduled_start,p_scheduled_end,p_guest_name,p_guest_phone,p_guest_email);
  INSERT INTO public.booking_friend_requests VALUES(p_tenant_id,auth.uid(),v_key,v_payload,v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.book_session_with_friend(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.book_session_with_friend(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,uuid) TO authenticated;
COMMIT;
