-- Authenticated provider evidence only. Signature verification remains in the
-- server route; SQL independently verifies both ends and the location binding.
BEGIN;
CREATE FUNCTION public.crm_pilot_inbound(p_account text,p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l crm_locations%ROWTYPE; p crm_pilot_config%ROWTYPE; t crm_threads%ROWTYPE;
 d jsonb; sid text:=COALESCE(p_event->>'MessageSid',p_event->>'CallSid');
 txt text:=trim(COALESCE(p_event->>'Body','')); is_call boolean:=p_event ? 'CallSid'; v_key text;
BEGIN
 SELECT * INTO l FROM crm_locations WHERE account_sid=p_account;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||l.location_id::text,0));
 SELECT * INTO p FROM crm_pilot_config WHERE location_id=l.location_id;
 IF p.location_id IS NULL OR sid IS NULL OR p_event->>'To' IS DISTINCT FROM l.sender
  OR NOT COALESCE(l.sender=ANY(p.approved_numbers),false)
  OR NOT COALESCE((p_event->>'From')=ANY(p.approved_numbers),false) THEN
  RAISE EXCEPTION 'Provider pilot identities not authorized'; END IF;
 v_key:='pilot:inbound:'||sid;
 INSERT INTO crm_provider_events(tenant_id,location_id,event_key,provider_sid,kind,status,evidence)
 VALUES(l.tenant_id,l.location_id,v_key,sid,CASE WHEN is_call THEN 'inbound_call' ELSE 'inbound' END,'received',p_event)
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN '{"duplicate":true}'; END IF;
 SELECT * INTO t FROM crm_threads WHERE location_id=l.location_id AND phone=p_event->>'From' FOR UPDATE;
 IF NOT FOUND THEN
  d:=jsonb_build_object('parent','Guardian verification required','athlete','Athlete not yet verified','age',NULL,
   'stage','New inquiry','revision',0,'hold',NULL,'consent',false,'voice_consent',false,'verified',false,
   'recipient_timezone',NULL,'owner',p.operator_id,'sms_draft','','note_draft','','selection',NULL,
   'booking',NULL,'callback',NULL,'offered','[]'::jsonb,'events','[]'::jsonb,
   'nurture',jsonb_build_object('status','review','reason','Identity and inquiry permission required','due',NULL,'version',1));
  INSERT INTO crm_threads(tenant_id,location_id,phone,data) VALUES(l.tenant_id,l.location_id,p_event->>'From',d) RETURNING * INTO t;
 END IF;
 d:=t.data||jsonb_build_object('revision',(t.data->>'revision')::int+1);
 IF upper(txt) IN ('STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT') THEN
  d:=d||'{"hold":"STOP","consent":false,"voice_consent":false}'::jsonb;
  UPDATE crm_outbox SET status='suppressed',reason='STOP suppression' WHERE thread_id=t.id AND status IN ('queued','held');
 END IF;
 IF is_call OR txt~*'call me|speak to|talk to|coach' THEN
  IF d->'callback'='null'::jsonb THEN
   d:=d||jsonb_build_object('callback',jsonb_build_object('id',gen_random_uuid(),'reason',
    CASE WHEN is_call THEN 'Inbound call: staff response required' ELSE 'Parent requested staff contact' END,
    'question',left(txt,500),'due',now(),'status','due','owner',p.operator_id));
  ELSE
   d:=jsonb_set(d,'{callback}',(d->'callback')||jsonb_build_object('status','due','due',now()));
  END IF;
  IF d->>'hold' IS DISTINCT FROM 'STOP' THEN d:=jsonb_set(d,'{hold}','"human"'); END IF;
 END IF;
 d:=d||jsonb_build_object('events',(d->'events')||crm_event(
  CASE WHEN is_call THEN 'inbound call' ELSE 'parent SMS' END,'parent',
  CASE WHEN is_call THEN 'Inbound staff-pilot call queued for staff follow-up' ELSE left(txt,4000) END,
  'received',l.account_sid LIKE 'AC_SYNTH_%'));
 UPDATE crm_threads SET data=d WHERE id=t.id;
 RETURN '{"recorded":true}';
END; $$;

CREATE FUNCTION public.crm_pilot_receipt(p_attempt uuid,p_leg text,p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a crm_pilot_attempts%ROWTYPE; l crm_locations%ROWTYPE; o crm_outbox%ROWTYPE;
 t crm_threads%ROWTYPE; sid text:=COALESCE(p_event->>'MessageSid',p_event->>'CallSid');
 v_status text:=COALESCE(p_event->>'MessageStatus',p_event->>'CallStatus');
 expected text; v_key text; d jsonb; next_status text; event_kind text;
BEGIN
 SELECT * INTO a FROM crm_pilot_attempts WHERE id=p_attempt;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown pilot attempt'; END IF;
 SELECT * INTO l FROM crm_locations WHERE location_id=a.location_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||a.location_id::text,0));
 SELECT * INTO a FROM crm_pilot_attempts WHERE id=p_attempt FOR UPDATE;
 SELECT * INTO o FROM crm_outbox WHERE id=a.outbox_id FOR UPDATE;
 expected:=CASE WHEN p_leg='staff' THEN a.request->>'staff_handset' ELSE a.request->>'recipient' END;
 IF sid IS NULL OR a.phase NOT IN ('attempting','finished') OR
  p_event->>'AccountSid' IS DISTINCT FROM a.request->>'account_sid' OR
  p_event->>'From' IS DISTINCT FROM a.request->>'sender' OR p_event->>'To' IS DISTINCT FROM expected OR
  NOT COALESCE((a.request->'approved_numbers') ? expected,false) OR
  NOT COALESCE((a.request->'approved_numbers') ? (p_event->>'From'),false) THEN
  RAISE EXCEPTION 'Provider attempt identities not authorized'; END IF;
 IF (o.purpose='call' AND (p_leg NOT IN ('staff','recipient') OR NOT p_event ? 'CallSid'))
  OR (o.purpose<>'call' AND (p_leg<>'sms' OR NOT p_event ? 'MessageSid')) THEN
  RAISE EXCEPTION 'Provider leg mismatch'; END IF;
 IF (p_leg='sms' AND v_status NOT IN ('accepted','queued','sending','sent','delivered','undelivered','failed'))
  OR (p_leg<>'sms' AND v_status NOT IN ('queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled')) THEN
  RAISE EXCEPTION 'Unknown provider status'; END IF;
 IF p_leg IN ('sms','staff') AND o.provider_sid IS NOT NULL AND o.provider_sid<>sid THEN
  RAISE EXCEPTION 'Provider attempt identity conflict'; END IF;
 IF p_leg='recipient' AND (NULLIF(p_event->>'ParentCallSid','') IS NULL OR
  (o.provider_sid IS NOT NULL AND o.provider_sid<>p_event->>'ParentCallSid')) THEN
  RAISE EXCEPTION 'Provider parent bridge mismatch'; END IF;
 event_kind:=CASE WHEN p_leg='sms' THEN 'sms_status' ELSE 'call_'||p_leg||'_status' END;
 v_key:='pilot:'||p_leg||':'||sid||':'||v_status;
 INSERT INTO crm_provider_events(tenant_id,location_id,event_key,provider_sid,kind,status,evidence)
 VALUES(l.tenant_id,l.location_id,v_key,sid,event_kind,v_status,p_event||jsonb_build_object('attempt_id',a.id))
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN '{"duplicate":true}'; END IF;
 SELECT * INTO t FROM crm_threads WHERE id=o.thread_id FOR UPDATE;
 d:=t.data;
 IF p_leg='sms' THEN
  next_status:=CASE WHEN o.status IN ('delivered','failed','undelivered') THEN o.status ELSE v_status END;
  UPDATE crm_outbox SET provider_sid=COALESCE(provider_sid,sid),status=next_status,
   reason='Signed SMS receipt: '||v_status WHERE id=o.id;
 ELSE
  -- A completed staff bridge does not prove the recipient answered, and even
  -- recipient answer can be voicemail. Only a staff disposition completes the
  -- human callback. Keep each leg's evidence separate.
  next_status:=p_leg||'_leg_'||v_status;
  UPDATE crm_outbox SET reason=CASE WHEN p_leg='staff' THEN
   'Staff bridge '||v_status||'; recipient answer not established'
   ELSE 'Recipient leg '||v_status||'; staff disposition required' END WHERE id=o.id;
  IF p_leg='staff' THEN UPDATE crm_outbox SET provider_sid=COALESCE(provider_sid,sid) WHERE id=o.id; END IF;
  IF p_leg='recipient' THEN UPDATE crm_outbox SET provider_sid=COALESCE(provider_sid,p_event->>'ParentCallSid') WHERE id=o.id; END IF;
  IF v_status IN ('busy','no-answer','failed','canceled')
   AND o.status NOT IN ('completed','no-answer','busy','failed') THEN
   IF d->'callback'='null'::jsonb THEN
    d:=d||jsonb_build_object('callback',jsonb_build_object('id',gen_random_uuid(),'reason',
     'Call not connected: '||v_status,'question','Staff follow-up required','due',now(),'status','due',
     'owner',(SELECT operator_id FROM crm_pilot_config WHERE location_id=l.location_id)));
   ELSE d:=jsonb_set(d,'{callback,status}','"due"'); END IF;
  END IF;
 END IF;
 d:=d||jsonb_build_object('revision',(d->>'revision')::int+1,
  'events',(d->'events')||crm_event('provider receipt','provider',
   CASE WHEN p_leg='staff' THEN 'Staff bridge '||v_status||'; recipient answer not established'
    ELSE p_leg||' receipt: '||v_status END,next_status,l.account_sid LIKE 'AC_SYNTH_%'));
 IF p_leg='sms' AND v_status IN ('failed','undelivered') THEN d:=jsonb_set(d,'{sms_draft}',to_jsonb(o.body)); END IF;
 UPDATE crm_threads SET data=d WHERE id=t.id;
 RETURN jsonb_build_object('recorded',true,'status',next_status);
END; $$;
REVOKE ALL ON FUNCTION crm_pilot_inbound(text,jsonb),crm_pilot_receipt(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION crm_pilot_inbound(text,jsonb),crm_pilot_receipt(uuid,text,jsonb) TO service_role;
COMMIT;
