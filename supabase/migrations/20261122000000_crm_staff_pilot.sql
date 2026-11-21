-- Staff-only staging pilot. Disabled by default; no number, grant, policy or
-- credential is provisioned here. Canonical scheduler/payment code is unchanged.
BEGIN;
CREATE TABLE public.crm_pilot_config (
 location_id uuid PRIMARY KEY REFERENCES crm_locations(location_id),
 operator_id uuid NOT NULL REFERENCES auth.users(id),
 staff_handset text, approved_numbers text[] NOT NULL DEFAULT '{}',
 approval text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT false,
 paused boolean NOT NULL DEFAULT true, revision int NOT NULL DEFAULT 1,
 last_worker_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL
);
CREATE TABLE public.crm_pilot_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 location_id uuid NOT NULL REFERENCES crm_locations(location_id),
 outbox_id uuid NOT NULL UNIQUE REFERENCES crm_outbox(id),
 policy_revision int NOT NULL, request jsonb NOT NULL,
 phase text NOT NULL DEFAULT 'prepared' CHECK(phase IN ('prepared','attempting','finished','blocked')),
 result jsonb, started_at timestamptz, finished_at timestamptz
);
ALTER TABLE crm_pilot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pilot_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_pilot_config,crm_pilot_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON crm_pilot_config,crm_pilot_attempts TO service_role;

CREATE FUNCTION public.crm_pilot_operator_allowed(p_operator uuid,p_tenant uuid,p_location uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(
  (claims->>'app_role' IN ('owner','admin')) AND claims->>'tenant_id'=p_tenant::text
  AND EXISTS(SELECT 1 FROM staff_locations WHERE user_id=p_operator AND location_id=p_location),false)
 FROM (SELECT public.custom_access_token_hook(jsonb_build_object('user_id',p_operator,
  'claims','{}'::jsonb))->'claims' AS claims) authority;
$$;

CREATE FUNCTION public.crm_pilot_reason(
 l crm_locations,t crm_threads,o crm_outbox,p crm_pilot_config
) RETURNS text LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE d jsonb:=t.data; h int; channel text;
BEGIN
 IF NOT p.active OR p.paused THEN RETURN 'Pilot paused; queued work retained'; END IF;
 IF l.connection='missing' THEN RETURN 'Location disconnected; reconnect and review before release'; END IF;
 IF l.connection NOT IN ('simulated','rehearsal') THEN RETURN 'Unapproved pilot connection'; END IF;
 IF p.approval='' OR l.dispatch_policy IS NULL THEN RETURN 'Approved contact policy required'; END IF;
 IF NOT crm_pilot_operator_allowed(p.operator_id,l.tenant_id,l.location_id) THEN
  RETURN 'Designated operator role or location grant missing'; END IF;
 IF NOT l.sender=ANY(p.approved_numbers) OR NOT t.phone=ANY(p.approved_numbers) THEN
  RETURN 'Sender or destination is not an approved staff test identity'; END IF;
 IF o.author<>'staff' THEN RETURN 'Outbound pilot work requires explicit staff review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM crm_actions a WHERE a.location_id=l.location_id
  AND a.key=o.logical_key AND a.actor=p.operator_id AND a.thread_id=t.id
  AND a.payload->>'kind' IN ('send','call')) THEN
  RETURN 'Designated operator review evidence required'; END IF;
 IF d->>'hold'='STOP' THEN RETURN 'STOP suppression'; END IF;
 IF NOT COALESCE((d->>'verified')::boolean,false) THEN RETURN 'Guardian unresolved'; END IF;
 channel:=CASE WHEN o.purpose='call' THEN 'voice_consent' ELSE 'consent' END;
 IF NOT COALESCE((d->>channel)::boolean,false) THEN RETURN 'Recorded inquiry permission required'; END IF;
 IF o.revision<>(d->>'revision')::int THEN RETURN 'Conversation changed; staff review required'; END IF;
 IF o.purpose='inquiry' AND d->'booking'<>'null'::jsonb THEN RETURN 'Verified booking stopped sales follow-up'; END IF;
 IF o.purpose='call' AND (p.staff_handset IS NULL OR NOT p.staff_handset=ANY(p.approved_numbers)
  OR p.staff_handset IN (l.sender,t.phone)) THEN RETURN 'Distinct approved staff handset required'; END IF;
 IF NULLIF(d->>'recipient_timezone','') IS NULL THEN RETURN 'Recipient timezone unresolved'; END IF;
 h:=extract(hour FROM now() AT TIME ZONE l.timezone);
 IF h<(l.dispatch_policy->>'start_hour')::int OR h>=(l.dispatch_policy->>'end_hour')::int THEN
  RETURN 'Outside facility contact window'; END IF;
 h:=extract(hour FROM now() AT TIME ZONE (d->>'recipient_timezone'));
 IF h<(l.dispatch_policy->>'start_hour')::int OR h>=(l.dispatch_policy->>'end_hour')::int THEN
  RETURN 'Outside recipient contact window'; END IF;
 IF (SELECT count(*) FROM crm_outbox WHERE location_id=l.location_id AND thread_id=t.id
  AND attempted_at>now()-interval '24 hours')>=(l.dispatch_policy->>'daily_cap')::int THEN
  RETURN 'Approved contact cap reached'; END IF;
 IF o.body='' OR o.body~'\{\{|\[[^]]*\]' THEN RETURN 'Reviewed resolved content required'; END IF;
 RETURN NULL;
END; $$;

CREATE FUNCTION public.crm_pilot_status(p_location uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l crm_locations%ROWTYPE; p crm_pilot_config%ROWTYPE;
BEGIN
 SELECT * INTO l FROM crm_locations WHERE location_id=p_location;
 IF NOT FOUND OR NOT COALESCE(crm_can_access(l.tenant_id,p_location),false) THEN
  RAISE EXCEPTION 'Location not authorized'; END IF;
 SELECT * INTO p FROM crm_pilot_config WHERE location_id=p_location;
 RETURN jsonb_build_object('configured',p.location_id IS NOT NULL,'active',COALESCE(p.active,false),
  'paused',COALESCE(p.paused,true),'operator_id',p.operator_id,
  'connection',l.connection,'can_configure',auth.jwt()->>'app_role'='owner',
  'approval_recorded',COALESCE(p.approval<>'',false),
  'allowlist_count',COALESCE(cardinality(p.approved_numbers),0),
  'staff_handset_configured',p.staff_handset IS NOT NULL,
  'operator_authorized',COALESCE(crm_pilot_operator_allowed(p.operator_id,l.tenant_id,p_location),false),
  'last_worker_at',p.last_worker_at,
  'next_action',CASE WHEN p.location_id IS NULL THEN 'Owner must approve the pilot operator and staff-only identities'
   WHEN l.connection='missing' THEN 'Owner must restore the approved sender; preserve holds and history'
   WHEN NOT p.active OR p.paused THEN 'Designated operator must explicitly start or resume the staff-only rehearsal'
   ELSE 'Staff-reviewed queue is eligible for dispatch-time checks; provider verification is separate' END,
  'outbox',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'thread_id',o.thread_id,
   'status',o.status,'reason',o.reason,'purpose',o.purpose,'attempted_at',o.attempted_at,
   'created_at',o.created_at,'evidence',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'kind',e.kind,'status',e.status,'at',e.received_at)) FROM crm_provider_events e
    WHERE e.location_id=p_location AND e.provider_sid=o.provider_sid),'[]'::jsonb)))
   FROM crm_outbox o WHERE o.location_id=p_location),'[]'::jsonb));
END; $$;

CREATE FUNCTION public.crm_pilot_manage(p_location uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l crm_locations%ROWTYPE; p crm_pilot_config%ROWTYPE; numbers text[]; v_operator uuid;
BEGIN
 SELECT * INTO l FROM crm_locations WHERE location_id=p_location;
 IF NOT FOUND OR NOT COALESCE(crm_can_access(l.tenant_id,p_location),false) THEN RAISE EXCEPTION 'Location not authorized'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||p_location::text,0));
 SELECT * INTO p FROM crm_pilot_config WHERE location_id=p_location FOR UPDATE;
 IF p_action='configure' THEN
  IF auth.jwt()->>'app_role'<>'owner' THEN RAISE EXCEPTION 'Owner configuration permission required'; END IF;
  v_operator:=(p_payload->>'operator_id')::uuid;
  IF NOT crm_pilot_operator_allowed(v_operator,l.tenant_id,p_location) THEN
   RAISE EXCEPTION 'Existing explicit operator location grant required; this action grants no access'; END IF;
  SELECT array_agg(value) INTO numbers FROM jsonb_array_elements_text(p_payload->'approved_numbers');
  IF l.sender IS NULL OR COALESCE(cardinality(numbers),0)<2 OR cardinality(numbers)>20 OR EXISTS(
    SELECT 1 FROM unnest(numbers) n WHERE n!~'^\+[1-9][0-9]{7,14}$')
    OR NOT l.sender=ANY(numbers) OR NULLIF(trim(p_payload->>'approval'),'') IS NULL THEN
   RAISE EXCEPTION 'Approved sender, staff test identities and approval evidence required'; END IF;
  IF p_payload->>'staff_handset' IS NOT NULL AND NOT (p_payload->>'staff_handset')=ANY(numbers) THEN
   RAISE EXCEPTION 'Staff handset must be allowlisted'; END IF;
  INSERT INTO crm_pilot_config(location_id,operator_id,staff_handset,approved_numbers,approval,updated_by)
  VALUES(p_location,v_operator,p_payload->>'staff_handset',numbers,left(p_payload->>'approval',2000),auth.uid())
  ON CONFLICT(location_id) DO UPDATE SET operator_id=EXCLUDED.operator_id,staff_handset=EXCLUDED.staff_handset,
   approved_numbers=EXCLUDED.approved_numbers,approval=EXCLUDED.approval,active=false,paused=true,
   revision=crm_pilot_config.revision+1,updated_at=now(),updated_by=auth.uid();
 ELSE
  IF p.location_id IS NULL THEN RAISE EXCEPTION 'Pilot configuration required'; END IF;
  IF auth.uid()<>p.operator_id AND auth.jwt()->>'app_role'<>'owner' THEN RAISE EXCEPTION 'Designated pilot operator required'; END IF;
  IF p_action='pause' THEN
   UPDATE crm_pilot_config SET paused=true,revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE location_id=p_location;
  ELSIF p_action IN ('start','resume') THEN
   IF auth.uid()<>p.operator_id OR p_payload->>'confirm' IS DISTINCT FROM 'STAFF ONLY' THEN
    RAISE EXCEPTION 'Designated operator must explicitly confirm STAFF ONLY'; END IF;
   IF l.connection='missing' OR l.dispatch_policy IS NULL THEN RAISE EXCEPTION 'Approved connection and contact policy required'; END IF;
   UPDATE crm_pilot_config SET active=true,paused=false,revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE location_id=p_location;
   -- Never reset attempted/unknown/STOP-suppressed rows. Eligibility is checked
   -- again by prepare and begin, not inferred from this restore action.
   UPDATE crm_outbox SET status='queued',reason='Released for fresh eligibility review'
    WHERE location_id=p_location AND status='held' AND attempted_at IS NULL;
  ELSIF p_action='disconnect' THEN
   IF auth.jwt()->>'app_role'<>'owner' THEN RAISE EXCEPTION 'Owner configuration permission required'; END IF;
   UPDATE crm_locations SET connection='missing' WHERE location_id=p_location;
   UPDATE crm_pilot_config SET paused=true,revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE location_id=p_location;
  ELSIF p_action='restore' THEN
   IF auth.jwt()->>'app_role'<>'owner' THEN RAISE EXCEPTION 'Owner configuration permission required'; END IF;
   IF l.sender IS NULL OR l.account_sid IS NULL OR l.credential_ref IS NULL THEN RAISE EXCEPTION 'Approved binding must be provisioned server-side first'; END IF;
   UPDATE crm_locations SET connection=CASE WHEN l.account_sid LIKE 'AC_SYNTH_%' THEN 'simulated' ELSE 'rehearsal' END WHERE location_id=p_location;
   UPDATE crm_pilot_config SET paused=true,revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE location_id=p_location;
  ELSE RAISE EXCEPTION 'Unsupported pilot operation'; END IF;
 END IF;
 INSERT INTO crm_activity(tenant_id,location_id,actor,kind,evidence) VALUES(l.tenant_id,p_location,auth.uid(),
  'pilot '||p_action,jsonb_build_object('approval_recorded',true));
 RETURN crm_pilot_status(p_location);
END; $$;

CREATE FUNCTION public.crm_pilot_prepare(p_location uuid,p_thread uuid DEFAULT NULL,p_worker boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
<<pilot_prepare>>
DECLARE l crm_locations%ROWTYPE; p crm_pilot_config%ROWTYPE; o crm_outbox%ROWTYPE;
 t crm_threads%ROWTYPE; reason text; v_id uuid; result jsonb:='[]'; payload jsonb;
BEGIN
 SELECT * INTO l FROM crm_locations WHERE location_id=p_location;
 SELECT * INTO p FROM crm_pilot_config WHERE location_id=p_location;
 IF l.location_id IS NULL OR p.location_id IS NULL THEN RETURN '[]'; END IF;
 IF NOT p_worker AND (NOT COALESCE(crm_can_access(l.tenant_id,p_location),false) OR auth.uid()<>p.operator_id) THEN
  RAISE EXCEPTION 'Designated pilot operator required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||p_location::text,0));
 SELECT * INTO l FROM crm_locations WHERE location_id=p_location;
 SELECT * INTO p FROM crm_pilot_config WHERE location_id=p_location;
 IF p_worker THEN UPDATE crm_pilot_config SET last_worker_at=now() WHERE location_id=p_location; END IF;
 FOR o IN SELECT * FROM crm_outbox WHERE location_id=p_location AND status='queued'
  AND (p_thread IS NULL OR thread_id=p_thread) ORDER BY created_at FOR UPDATE LOOP
  SELECT * INTO t FROM crm_threads WHERE id=o.thread_id AND location_id=p_location FOR UPDATE;
  reason:=crm_pilot_reason(l,t,o,p);
  IF reason IS NOT NULL THEN
   UPDATE crm_outbox SET status=CASE WHEN pilot_prepare.reason IN ('STOP suppression','Verified booking stopped sales follow-up')
    THEN 'suppressed' ELSE 'held' END,reason=pilot_prepare.reason WHERE id=o.id;
   UPDATE crm_threads SET data=data||jsonb_build_object('sms_draft',CASE WHEN o.purpose='call' THEN data->>'sms_draft' ELSE o.body END) WHERE id=t.id;
   CONTINUE;
  END IF;
  payload:=jsonb_build_object('account_sid',l.account_sid,'sender',l.sender,'recipient',t.phone,
   'staff_handset',p.staff_handset,'credential_ref',l.credential_ref,'callback_url',l.webhook_url,
   'kind',CASE WHEN o.purpose='call' THEN 'call' ELSE 'sms' END,'body',o.body,
   'approval',p.approval,'approved_numbers',to_jsonb(p.approved_numbers));
  INSERT INTO crm_pilot_attempts(location_id,outbox_id,policy_revision,request)
   VALUES(p_location,o.id,p.revision,payload)
   ON CONFLICT(outbox_id) DO UPDATE SET phase='prepared',request=EXCLUDED.request,
    policy_revision=EXCLUDED.policy_revision,result=NULL
    WHERE crm_pilot_attempts.phase IN ('prepared','blocked')
   RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN result:=result||to_jsonb(v_id); END IF;
 END LOOP;
 RETURN result;
END; $$;

CREATE FUNCTION public.crm_pilot_begin(p_attempt uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
<<pilot_begin>>
DECLARE a crm_pilot_attempts%ROWTYPE; l crm_locations%ROWTYPE; p crm_pilot_config%ROWTYPE;
 t crm_threads%ROWTYPE; o crm_outbox%ROWTYPE; reason text;
BEGIN
 SELECT * INTO a FROM crm_pilot_attempts WHERE id=p_attempt;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO l FROM crm_locations WHERE location_id=a.location_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||a.location_id::text,0));
 SELECT * INTO a FROM crm_pilot_attempts WHERE id=p_attempt FOR UPDATE;
 IF a.phase<>'prepared' THEN RETURN NULL; END IF;
 SELECT * INTO p FROM crm_pilot_config WHERE location_id=a.location_id;
 SELECT * INTO o FROM crm_outbox WHERE id=a.outbox_id FOR UPDATE;
 SELECT * INTO t FROM crm_threads WHERE id=o.thread_id FOR UPDATE;
 reason:=crm_pilot_reason(l,t,o,p);
 IF o.status<>'queued' THEN reason:='Queue state changed; do not dispatch'; END IF;
 IF a.policy_revision<>p.revision THEN reason:='Pilot configuration changed; review before release'; END IF;
 IF reason IS NOT NULL THEN
  UPDATE crm_pilot_attempts SET phase='blocked',result=jsonb_build_object('status','blocked','reason',reason) WHERE id=a.id;
  UPDATE crm_outbox SET status=CASE WHEN o.status='queued' THEN 'held' ELSE o.status END,reason=pilot_begin.reason WHERE id=o.id;
  RETURN NULL;
 END IF;
 -- Commit this BEFORE touching the network. Crash/restart from here is unknown
 -- and must never automatically resend the same attempt.
 UPDATE crm_pilot_attempts SET phase='attempting',started_at=now() WHERE id=a.id;
 UPDATE crm_outbox SET status='unknown',reason='Attempt started; reconcile if interrupted',attempted_at=now() WHERE id=o.id;
 RETURN a.request||jsonb_build_object('id',a.id,'simulated',l.connection='simulated');
END; $$;

CREATE FUNCTION public.crm_pilot_finish(p_attempt uuid,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a crm_pilot_attempts%ROWTYPE; o crm_outbox%ROWTYPE; l crm_locations%ROWTYPE;
 v_status text:=p_result->>'status';
BEGIN
 IF v_status NOT IN ('accepted','failed','unknown','blocked') THEN RAISE EXCEPTION 'Invalid dispatch result'; END IF;
 SELECT * INTO a FROM crm_pilot_attempts WHERE id=p_attempt;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO l FROM crm_locations WHERE location_id=a.location_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||a.location_id::text,0));
 SELECT * INTO a FROM crm_pilot_attempts WHERE id=p_attempt FOR UPDATE;
 IF a.phase<>'attempting' THEN RETURN; END IF;
 SELECT * INTO o FROM crm_outbox WHERE id=a.outbox_id FOR UPDATE;
 UPDATE crm_pilot_attempts SET phase='finished',result=p_result,finished_at=now() WHERE id=a.id;
 UPDATE crm_outbox SET status=CASE WHEN status IN ('delivered','failed','undelivered') THEN status ELSE v_status END,
  provider_sid=COALESCE(provider_sid,p_result->>'provider_sid'),reason=left(p_result->>'reason',300) WHERE id=o.id;
 UPDATE crm_threads SET data=data||jsonb_build_object(
  'sms_draft',CASE WHEN v_status IN ('failed','unknown','blocked') AND o.purpose<>'call' THEN o.body ELSE data->>'sms_draft' END,
  'events',(data->'events')||crm_event('dispatch evidence','provider',left(p_result->>'reason',300),v_status,l.connection='simulated'))
  WHERE id=o.thread_id;
END; $$;

ALTER FUNCTION public.crm_execute(uuid,jsonb) RENAME TO crm_execute_core;
REVOKE ALL ON FUNCTION public.crm_execute_core(uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.crm_execute(p_location uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l crm_locations%ROWTYPE; p crm_pilot_config%ROWTYPE; t crm_threads%ROWTYPE; d jsonb; k text:=p_command->>'kind';
BEGIN
 SELECT * INTO l FROM crm_locations WHERE location_id=p_location;
 IF NOT FOUND OR NOT COALESCE(crm_can_access(l.tenant_id,p_location),false) THEN RAISE EXCEPTION 'Location not authorized'; END IF;
 SELECT * INTO p FROM crm_pilot_config WHERE location_id=p_location;
 IF p.location_id IS NOT NULL AND k IN ('send','call') AND
  (auth.uid()<>p.operator_id OR p_command->>'source'='agent') THEN
  RAISE EXCEPTION 'Designated staff operator must review outbound work'; END IF;
 IF p.location_id IS NOT NULL AND k='dispatch' THEN
  PERFORM crm_pilot_prepare(p_location,(p_command->>'thread_id')::uuid,false);
  RETURN crm_snapshot(p_location);
 ELSIF p.location_id IS NOT NULL AND k='call_outcome' THEN
  IF auth.uid()<>p.operator_id THEN RAISE EXCEPTION 'Designated staff operator required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM crm_outbox WHERE thread_id=(p_command->>'thread_id')::uuid
   AND location_id=p_location AND purpose='call' AND attempted_at IS NOT NULL
   AND status IN ('accepted','unknown','initiated')) THEN RAISE EXCEPTION 'Attempted call required before recording an outcome'; END IF;
  d:=crm_execute_core(p_location,p_command);
  UPDATE crm_outbox SET status=p_command->>'outcome',reason='Explicit staff disposition; not inferred from bridge'
   WHERE thread_id=(p_command->>'thread_id')::uuid AND location_id=p_location AND purpose='call'
   AND status IN ('accepted','unknown','initiated');
  IF p_command->>'outcome'<>'completed' THEN
   UPDATE crm_threads SET data=jsonb_set(data,'{callback}',CASE WHEN data->'callback'='null'::jsonb THEN
    jsonb_build_object('id',gen_random_uuid(),'reason','Staff reported call not answered','question',
    'Staff callback required','due',now(),'status','due','owner',p.operator_id)
    ELSE (data->'callback')||'{"status":"due"}'::jsonb END)
    WHERE id=(p_command->>'thread_id')::uuid AND location_id=p_location;
  END IF;
  RETURN crm_snapshot(p_location);
 ELSIF p.location_id IS NOT NULL AND k='call' THEN
  IF auth.uid()<>p.operator_id OR p_command->>'source'='agent' THEN RAISE EXCEPTION 'Designated staff operator must initiate calls'; END IF;
  IF NULLIF(p_command->>'key','') IS NULL THEN RAISE EXCEPTION 'Stable call action key required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||p_location::text,0));
  IF EXISTS(SELECT 1 FROM crm_actions WHERE location_id=p_location AND key=p_command->>'key' AND payload<>p_command) THEN
   RAISE EXCEPTION 'Action key reused with different arguments'; END IF;
  IF EXISTS(SELECT 1 FROM crm_actions WHERE location_id=p_location AND key=p_command->>'key') THEN RETURN crm_snapshot(p_location); END IF;
  SELECT * INTO t FROM crm_threads WHERE id=(p_command->>'thread_id')::uuid AND location_id=p_location FOR UPDATE;
  IF NOT FOUND OR (p_command->>'revision')::int IS DISTINCT FROM (t.data->>'revision')::int THEN RAISE EXCEPTION 'Conversation changed; review required'; END IF;
  IF EXISTS(SELECT 1 FROM crm_outbox WHERE thread_id=t.id AND purpose='call' AND status IN ('queued','accepted','unknown','initiated')) THEN RAISE EXCEPTION 'Call attempt already active or uncertain'; END IF;
  d:=t.data||jsonb_build_object('revision',(t.data->>'revision')::int+1,
   'events',(t.data->'events')||crm_event('call','staff','Staff-reviewed facility call queued','initiated',l.connection='simulated'));
  INSERT INTO crm_outbox(tenant_id,location_id,thread_id,logical_key,revision,author,body,purpose)
   VALUES(l.tenant_id,p_location,t.id,p_command->>'key',(d->>'revision')::int,'staff','Staff-reviewed facility call','call');
  UPDATE crm_threads SET data=d WHERE id=t.id;
  INSERT INTO crm_actions(tenant_id,location_id,key,thread_id,payload,actor) VALUES(l.tenant_id,p_location,p_command->>'key',t.id,p_command,auth.uid());
  RETURN crm_snapshot(p_location);
 END IF;
 RETURN crm_execute_core(p_location,p_command);
END; $$;

REVOKE ALL ON FUNCTION crm_pilot_reason(crm_locations,crm_threads,crm_outbox,crm_pilot_config),
 crm_pilot_operator_allowed(uuid,uuid,uuid),crm_pilot_prepare(uuid,uuid,boolean),crm_pilot_begin(uuid),crm_pilot_finish(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION crm_pilot_prepare(uuid,uuid,boolean),crm_pilot_begin(uuid),crm_pilot_finish(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION crm_pilot_manage(uuid,text,jsonb),crm_pilot_status(uuid),crm_execute(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_pilot_manage(uuid,text,jsonb),crm_pilot_status(uuid),crm_execute(uuid,jsonb) TO authenticated;
COMMIT;
