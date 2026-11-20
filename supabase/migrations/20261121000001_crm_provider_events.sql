BEGIN;
CREATE TABLE public.crm_reminder_intents (
 booking_id uuid PRIMARY KEY REFERENCES public.bookings(id),tenant_id uuid NOT NULL,location_id uuid NOT NULL,
 due_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'staff_review',revision int NOT NULL DEFAULT 1,
 reason text NOT NULL DEFAULT 'Separate appointment reminder; no automatic parent outreach'
);
ALTER TABLE public.crm_reminder_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_reminder_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.crm_reminder_intents TO authenticated;
CREATE POLICY reminder_staff_read ON public.crm_reminder_intents FOR SELECT TO authenticated
 USING(public.crm_can_access(tenant_id,location_id));
CREATE FUNCTION public.crm_reminder_observer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM crm_threads WHERE location_id=NEW.location_id AND (id=NEW.crm_prospect_id OR kid_id=NEW.kid_id)) THEN
  INSERT INTO crm_reminder_intents(booking_id,tenant_id,location_id,due_at,status)
  VALUES(NEW.id,NEW.tenant_id,NEW.location_id,NEW.scheduled_start-interval '24 hours',
   CASE WHEN NEW.status='confirmed' THEN 'staff_review' ELSE 'cancelled' END)
  ON CONFLICT(booking_id) DO UPDATE SET due_at=EXCLUDED.due_at,status=EXCLUDED.status,
   revision=crm_reminder_intents.revision+1,reason='Canonical booking changed; reminder recalculated, sales nurture not restarted';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER crm_reminder_observer AFTER INSERT OR UPDATE OF scheduled_start,status ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION public.crm_reminder_observer();

CREATE TABLE public.crm_internal_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,location_id uuid NOT NULL,
 kid_id uuid NOT NULL REFERENCES public.kids(id),kind text NOT NULL DEFAULT 'reevaluation',
 due_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'due',reason text NOT NULL,
 completed_at timestamptz,UNIQUE(location_id,kid_id,kind)
);
ALTER TABLE public.crm_internal_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_internal_tasks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.crm_internal_tasks TO authenticated;
CREATE POLICY internal_tasks_staff_read ON public.crm_internal_tasks FOR SELECT TO authenticated
 USING(public.crm_can_access(tenant_id,location_id));
CREATE FUNCTION public.crm_reevaluate(p_location uuid,p_complete uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t uuid:=(auth.jwt()->>'tenant_id')::uuid;
BEGIN
 IF NOT COALESCE(crm_can_access(t,p_location),false) THEN RAISE EXCEPTION 'Location not authorized'; END IF;
 IF p_complete IS NOT NULL THEN UPDATE crm_internal_tasks SET status='complete',completed_at=now() WHERE id=p_complete AND location_id=p_location AND tenant_id=t; END IF;
 -- Due today through ten days; missing/overdue dates do not satisfy the rule.
 INSERT INTO crm_internal_tasks(tenant_id,location_id,kid_id,due_at,reason)
 SELECT DISTINCT t,p_location,b.kid_id,now(),'Upcoming canonical visit plus next payment within ten days. INTERNAL ONLY.'
 FROM bookings b JOIN memberships m ON m.kid_id=b.kid_id AND m.tenant_id=b.tenant_id
 WHERE b.tenant_id=t AND b.location_id=p_location AND b.status='confirmed' AND b.scheduled_start>now()
 AND NULLIF(to_jsonb(m)->>'next_billing_at','')::timestamptz BETWEEN now() AND now()+interval '10 days'
 ON CONFLICT(location_id,kid_id,kind) DO UPDATE SET due_at=now()+interval '1 day'
 WHERE crm_internal_tasks.status<>'complete' AND crm_internal_tasks.due_at<now();
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM crm_internal_tasks x WHERE location_id=p_location),'[]');
END; $$;

-- Only server routes can call this, AFTER signature validation and binding
-- lookup. Authenticated clients cannot manufacture provider evidence.
CREATE FUNCTION public.crm_provider_event(p_account text,p_destination text,p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l crm_locations%ROWTYPE; t crm_threads%ROWTYPE; d jsonb; o crm_outbox%ROWTYPE;
 sid text:=COALESCE(p_event->>'MessageSid',p_event->>'CallSid'); kind text:=p_event->>'kind';
 status text:=COALESCE(p_event->>'MessageStatus',p_event->>'CallStatus','received');
 v_event_key text; previous text; next_status text; txt text:=trim(COALESCE(p_event->>'Body','')); sim boolean; is_new boolean:=false;
BEGIN
 SELECT * INTO l FROM crm_locations WHERE account_sid=p_account AND sender=p_destination AND connection<>'missing';
 IF NOT FOUND OR sid IS NULL THEN RAISE EXCEPTION 'Provider binding denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||l.location_id::text,0));
 sim:=l.connection='simulated';
 v_event_key:=sid||':'||kind||':'||status;
 IF EXISTS(SELECT 1 FROM crm_provider_events WHERE location_id=l.location_id AND crm_provider_events.event_key=v_event_key) THEN RETURN jsonb_build_object('duplicate',true); END IF;
 INSERT INTO crm_provider_events(tenant_id,location_id,event_key,provider_sid,kind,status,evidence)
 VALUES(l.tenant_id,l.location_id,v_event_key,sid,kind,status,p_event);
 IF kind IN ('inbound','inbound_call') THEN
  SELECT * INTO t FROM crm_threads WHERE location_id=l.location_id AND phone=p_event->>'From' FOR UPDATE;
  IF NOT FOUND THEN
   is_new:=true;
   INSERT INTO crm_threads(tenant_id,location_id,phone,data)
   VALUES(l.tenant_id,l.location_id,p_event->>'From',jsonb_build_object('parent','Unverified parent','athlete','Athlete not yet verified','age',0,
    'stage','New inquiry','revision',0,'hold',NULL,'consent',false,'verified',false,'owner',NULL,
    'sms_draft','','note_draft','','selection',NULL,'booking',NULL,'callback',NULL,'events','[]'::jsonb,'offered','[]'::jsonb,
    'nurture',jsonb_build_object('status','waiting','reason','Inbound inquiry does not grant outreach permission','version',l.workflow->'version',
     'wording',l.workflow->>'wording','due',now()+make_interval(mins=>(l.workflow->>'delay_minutes')::int)))) RETURNING * INTO t;
  END IF;
  d:=t.data;
  IF upper(txt) IN ('STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT') THEN
   d:=d||jsonb_build_object('hold','STOP','consent',false);
   UPDATE crm_outbox SET status='suppressed',reason='STOP suppression' WHERE thread_id=t.id AND crm_outbox.status='queued';
  END IF;
  IF kind='inbound_call' OR lower(txt)~'(coach|call me)' THEN
   IF d->'callback'='null'::jsonb THEN
    d:=d||jsonb_build_object('callback',jsonb_build_object('id',gen_random_uuid(),'reason',CASE WHEN kind='inbound_call' THEN 'Incoming / missed facility call' ELSE 'Parent requests coach' END,
    'question',txt,'due',now()+interval '1 hour','status',CASE WHEN COALESCE(l.callback_owner::text,d->>'owner') IS NULL THEN 'unassigned' ELSE 'due' END,
    'owner',COALESCE(l.callback_owner::text,d->>'owner','Staff queue')));
   END IF;
   IF d->>'hold' IS DISTINCT FROM 'STOP' THEN d:=jsonb_set(d,'{hold}','"human"'); END IF;
  END IF;
  d:=d||jsonb_build_object('revision',(d->>'revision')::int+1,'events',(d->'events')||crm_event(CASE WHEN kind='inbound_call' THEN 'call' ELSE 'parent SMS' END,'parent',txt,status,sim));
  IF NOT is_new AND d->'nurture'->>'status'<>'stopped' THEN
   d:=jsonb_set(jsonb_set(d,'{nurture,reason}','"Parent reply routed to active conversation; staff review"'),'{nurture,status}','"replied"');
   UPDATE crm_outbox SET status='suppressed',reason='Parent replied; staff review' WHERE thread_id=t.id AND crm_outbox.status='queued' AND author='workflow';
  END IF;
  UPDATE crm_threads SET data=d WHERE id=t.id;
 ELSE
  SELECT * INTO o FROM crm_outbox WHERE location_id=l.location_id AND provider_sid=sid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('recorded',true,'reconciliation','Unmatched provider reference retained'); END IF;
  IF p_event->>'To' IS DISTINCT FROM (SELECT phone FROM crm_threads WHERE id=o.thread_id) THEN
   RAISE EXCEPTION 'Provider recipient mismatch'; END IF;
  IF status NOT IN ('queued','accepted','sending','sent','delivered','undelivered','failed','initiated','ringing','in-progress','completed','busy','no-answer','canceled') THEN RAISE EXCEPTION 'Unknown provider status'; END IF;
  previous:=o.status;
  -- First terminal status is sticky; retain every conflicting receipt in events.
  next_status:=CASE WHEN previous IN ('delivered','undelivered','failed','completed','busy','no-answer','canceled') THEN previous
   WHEN status IN ('delivered','undelivered','failed','completed','busy','no-answer','canceled') THEN status
   WHEN kind='call_status' AND array_position(ARRAY['queued','initiated','ringing','in-progress'],status)<array_position(ARRAY['queued','initiated','ringing','in-progress'],previous) THEN previous
   WHEN array_position(ARRAY['queued','accepted','sending','sent'],status)<array_position(ARRAY['queued','accepted','sending','sent'],previous) THEN previous
   ELSE status END;
  UPDATE crm_outbox SET status=next_status WHERE id=o.id;
  SELECT * INTO t FROM crm_threads WHERE id=o.thread_id FOR UPDATE;
  UPDATE crm_threads SET data=data||jsonb_build_object('revision',(data->>'revision')::int+1,
   'events',(data->'events')||crm_event('provider receipt','provider','Observed '||status||'; retained state '||next_status,next_status,sim)) WHERE id=t.id;
  IF kind='call_status' AND next_status IN ('completed','busy','no-answer','failed','canceled') THEN
   UPDATE crm_threads SET data=jsonb_set(data,'{events}',(SELECT jsonb_agg(
    CASE WHEN e->>'kind'='call' AND e->>'status'='initiated' THEN e||jsonb_build_object('status',next_status) ELSE e END)
    FROM jsonb_array_elements(data->'events') e)) WHERE id=t.id;
  END IF;
 END IF;
 INSERT INTO crm_activity(tenant_id,location_id,thread_id,kind,evidence) VALUES(l.tenant_id,l.location_id,t.id,'provider event',jsonb_build_object('sid',sid,'status',status,'kind',kind));
 RETURN jsonb_build_object('recorded',true);
END; $$;
REVOKE ALL ON FUNCTION public.crm_provider_event(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_provider_event(text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.crm_reevaluate(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_reevaluate(uuid,uuid) TO authenticated;
COMMIT;
