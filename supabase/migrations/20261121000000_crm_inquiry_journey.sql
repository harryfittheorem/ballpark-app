-- Native inquiry journey. No provider credentials or default live enablement.
BEGIN;
CREATE FUNCTION public.crm_can_access(p_tenant uuid,p_location uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND p_tenant=(auth.jwt()->>'tenant_id')::uuid
 AND auth.jwt()->>'app_role' IN ('owner','admin')
 AND EXISTS(SELECT 1 FROM locations WHERE id=p_location AND tenant_id=p_tenant)
 AND EXISTS(SELECT 1 FROM staff_locations WHERE user_id=auth.uid() AND location_id=p_location);
$$;

CREATE TABLE public.crm_locations (
 location_id uuid PRIMARY KEY REFERENCES public.locations(id),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 timezone text NOT NULL, sender text, account_sid text UNIQUE, credential_ref text,webhook_url text,
 callback_owner uuid REFERENCES auth.users(id),
 dispatch_policy jsonb CHECK(dispatch_policy IS NULL OR COALESCE(
  (dispatch_policy->>'start_hour')::int BETWEEN 0 AND 23
  AND (dispatch_policy->>'end_hour')::int BETWEEN 1 AND 24
  AND (dispatch_policy->>'start_hour')::int<(dispatch_policy->>'end_hour')::int
  AND (dispatch_policy->>'daily_cap')::int BETWEEN 1 AND 100
  AND NULLIF(dispatch_policy->>'approval','') IS NOT NULL,false)),
 connection text NOT NULL DEFAULT 'missing' CHECK(connection IN ('missing','simulated','rehearsal')),
 workflow jsonb NOT NULL DEFAULT '{"version":1,"enabled":false,"delay_minutes":1440,"wording":"Would you like help finding an evaluation time?","authority":"draft","knowledge":"Only offer configured evaluation openings. No pricing, discounts or guarantees are approved.","history":[]}',
 CHECK (connection='missing' OR (sender IS NOT NULL AND account_sid IS NOT NULL AND credential_ref IS NOT NULL))
);
-- Contact/athlete context is a prospect until a staff-verified canonical link.
-- JSON holds the bounded view state; canonical identity and booking stay relational.
CREATE TABLE public.crm_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 location_id uuid NOT NULL REFERENCES public.crm_locations(location_id),
 phone text NOT NULL, family_id uuid REFERENCES public.families(id),kid_id uuid REFERENCES public.kids(id),
 data jsonb NOT NULL, UNIQUE(location_id,phone)
);
CREATE TABLE public.crm_actions (
 tenant_id uuid NOT NULL,location_id uuid NOT NULL REFERENCES public.crm_locations(location_id),
 key text NOT NULL,thread_id uuid REFERENCES public.crm_threads(id),payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'committed',result jsonb,actor uuid,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(location_id,key)
);
CREATE TABLE public.crm_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,location_id uuid NOT NULL,
 thread_id uuid REFERENCES public.crm_threads(id),actor uuid,kind text NOT NULL,evidence jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crm_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,location_id uuid NOT NULL,
 thread_id uuid NOT NULL REFERENCES public.crm_threads(id),logical_key text NOT NULL,
 revision int NOT NULL,author text NOT NULL,purpose text NOT NULL DEFAULT 'inquiry',body text NOT NULL,
 status text NOT NULL DEFAULT 'queued',reason text,provider_sid text,attempted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(location_id,logical_key)
);
CREATE TABLE public.crm_provider_events (
 tenant_id uuid NOT NULL,location_id uuid NOT NULL REFERENCES public.crm_locations(location_id),event_key text NOT NULL,
 provider_sid text NOT NULL,kind text NOT NULL,status text,received_at timestamptz NOT NULL DEFAULT now(),
 evidence jsonb NOT NULL,PRIMARY KEY(location_id,event_key)
);
-- Openings are approved evaluation inventory referencing canonical coaches,
-- session types and cages. Availability/reservation consume the shared guards.
CREATE TABLE public.crm_evaluation_openings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,location_id uuid NOT NULL REFERENCES public.crm_locations(location_id),
 session_type_id uuid NOT NULL REFERENCES public.session_types(id),coach_id uuid NOT NULL REFERENCES public.coaches(id),
 cage_number text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 CHECK(ends_at>starts_at),UNIQUE(location_id,coach_id,starts_at)
);
CREATE TABLE public.crm_evaluation_services (
 location_id uuid NOT NULL REFERENCES public.crm_locations(location_id),tenant_id uuid NOT NULL,
 session_type_id uuid NOT NULL REFERENCES public.session_types(id),PRIMARY KEY(location_id,session_type_id)
);
ALTER TABLE public.bookings ALTER COLUMN kid_id DROP NOT NULL;
ALTER TABLE public.bookings ADD COLUMN crm_prospect_id uuid REFERENCES public.crm_threads(id);
-- Only this adapter may create an un-enrolled prospect reservation. Existing
-- member inserts remain subject to the scheduler's entitlement contract.
CREATE FUNCTION public.crm_prospect_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kid_id IS NULL AND (NEW.crm_prospect_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.crm_threads t WHERE t.id=NEW.crm_prospect_id
     AND t.tenant_id=NEW.tenant_id AND t.location_id=NEW.location_id
     AND (t.data->>'verified')::boolean))
 THEN RAISE EXCEPTION 'verified_prospect_required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER crm_prospect_guard BEFORE INSERT OR UPDATE ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION public.crm_prospect_guard();
CREATE UNIQUE INDEX crm_one_evaluation_per_prospect ON public.bookings(crm_prospect_id)
 WHERE crm_prospect_id IS NOT NULL AND status NOT IN ('cancelled','no_show');

DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['crm_locations','crm_threads','crm_actions','crm_activity','crm_outbox','crm_provider_events','crm_evaluation_openings','crm_evaluation_services'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
  -- Binding account/credential references are deliberately server-only.
  IF n<>'crm_locations' THEN
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',n);
   EXECUTE format('CREATE POLICY crm_staff_read ON public.%I FOR SELECT TO authenticated USING(public.crm_can_access(tenant_id,location_id))',n);
  END IF;
  EXECUTE format('GRANT ALL ON public.%I TO service_role',n);
 END LOOP;
END $$;

CREATE FUNCTION public.crm_event(p_kind text,p_author text,p_body text,p_status text,p_sim boolean)
RETURNS jsonb LANGUAGE sql VOLATILE AS $$
 SELECT jsonb_build_object('id',gen_random_uuid(),'kind',p_kind,'author',p_author,'body',p_body,'status',p_status,'at',now(),'simulated',p_sim);
$$;
CREATE FUNCTION public.crm_snapshot(p_location uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l crm_locations%ROWTYPE; v_threads jsonb; v_slots jsonb;
BEGIN
 SELECT * INTO l FROM crm_locations WHERE location_id=p_location;
 IF NOT FOUND OR NOT COALESCE(crm_can_access(l.tenant_id,p_location),false) THEN RAISE EXCEPTION 'Location not authorized'; END IF;
 SELECT COALESCE(jsonb_agg(t.data||jsonb_build_object('id',t.id,'phone',t.phone,'family_id',t.family_id,'kid_id',t.kid_id) ORDER BY t.data->'nurture'->>'due'),'[]') INTO v_threads
 FROM crm_threads t WHERE location_id=p_location;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,
 'coach',c.first_name||' '||c.last_name,'cage',s.cage_number,
 'available',s.starts_at>now() AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.location_id=p_location
 AND b.status NOT IN ('cancelled','no_show') AND b.scheduled_start<s.ends_at AND b.scheduled_end>s.starts_at
 AND (b.coach_id=s.coach_id OR b.cage_number=s.cage_number))
 AND booking_capacity_has_room(l.tenant_id,p_location,false,s.starts_at,s.ends_at,NULL,1)) ORDER BY s.starts_at),'[]') INTO v_slots
 FROM crm_evaluation_openings s JOIN coaches c ON c.id=s.coach_id AND c.is_active AND c.tenant_id=l.tenant_id
 JOIN coach_locations cl ON cl.coach_id=c.id AND cl.location_id=p_location
 JOIN session_types st ON st.id=s.session_type_id AND st.tenant_id=l.tenant_id AND st.is_active
 JOIN crm_evaluation_services es ON es.location_id=p_location AND es.tenant_id=l.tenant_id AND es.session_type_id=st.id
 JOIN scheduling_resources r ON r.location_id=p_location AND r.tenant_id=l.tenant_id AND r.cage_number=s.cage_number AND r.is_active AND r.purpose IN ('instruction','both')
 WHERE s.location_id=p_location AND s.tenant_id=l.tenant_id AND s.ends_at=s.starts_at+make_interval(mins=>st.duration_minutes)
 AND EXISTS(SELECT 1 FROM coach_availability ca WHERE ca.coach_id=s.coach_id AND ca.location_id=p_location AND ca.tenant_id=l.tenant_id
 AND ca.day_of_week=extract(dow FROM s.starts_at AT TIME ZONE l.timezone)
 AND (s.starts_at AT TIME ZONE l.timezone)::time>=ca.start_time AND (s.ends_at AT TIME ZONE l.timezone)::time<=ca.end_time
 AND (s.starts_at AT TIME ZONE l.timezone)::date=(s.ends_at AT TIME ZONE l.timezone)::date
 AND (ca.effective_from IS NULL OR ca.effective_from<=(s.starts_at AT TIME ZONE l.timezone)::date)
 AND (ca.effective_until IS NULL OR ca.effective_until>=(s.starts_at AT TIME ZONE l.timezone)::date));
 RETURN jsonb_build_object('location',jsonb_build_object('id',p_location,'name',(SELECT name FROM locations WHERE id=p_location),
 'timezone',l.timezone,'sender',COALESCE(l.sender,'Not connected'),'connection',l.connection,'simulated',l.connection='simulated'),
 'threads',v_threads,'slots',v_slots,'workflow',l.workflow,
 'internal_tasks',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM crm_internal_tasks x WHERE x.location_id=p_location),'[]'),
 'reminders',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM crm_reminder_intents x WHERE x.location_id=p_location),'[]'));
END; $$;

-- Canonical booking events stop nurture regardless of entry path, and update
-- reminders separately. No booking-event handler sends a confirmation itself.
CREATE FUNCTION public.crm_booking_observer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t crm_threads%ROWTYPE; d jsonb;
BEGIN
 IF NEW.status='cancelled' THEN
  FOR t IN SELECT * FROM crm_threads WHERE tenant_id=NEW.tenant_id AND location_id=NEW.location_id
   AND data->'booking'->>'id'=NEW.id::text FOR UPDATE LOOP
   UPDATE crm_threads SET data=t.data||jsonb_build_object('stage','In follow-up','selection',NULL,'offered','[]'::jsonb,
    'booking',(t.data->'booking')||jsonb_build_object('status','cancelled'),
    'nurture',(t.data->'nurture')||jsonb_build_object('status','stopped','reason','Evaluation cancelled; staff review required, sales nurture not restarted'),
    'revision',(t.data->>'revision')::int+1,
    'events',(t.data->'events')||crm_event('booking','scheduler','Evaluation cancelled; reminders cancelled and sales nurture remains stopped.','cancelled',false)) WHERE id=t.id;
  END LOOP;
  RETURN NEW;
 END IF;
 IF NEW.status NOT IN ('confirmed','completed') OR NOT EXISTS(SELECT 1 FROM crm_evaluation_services WHERE location_id=NEW.location_id AND tenant_id=NEW.tenant_id AND session_type_id=NEW.session_type_id) THEN RETURN NEW; END IF;
 FOR t IN SELECT * FROM crm_threads WHERE tenant_id=NEW.tenant_id AND location_id=NEW.location_id
 AND (id=NEW.crm_prospect_id OR (kid_id IS NOT NULL AND kid_id=NEW.kid_id)) FOR UPDATE LOOP
 d:=t.data||jsonb_build_object('stage','Evaluation booked','booking',jsonb_build_object('id',NEW.id,'starts_at',NEW.scheduled_start,'status',NEW.status),
 'nurture',(t.data->'nurture')||jsonb_build_object('status','stopped','reason','Verified canonical booking '||NEW.id),
 'revision',(t.data->>'revision')::int+1,
 'events',(t.data->'events')||crm_event('booking','scheduler','Evaluation committed; sales follow-up stopped. Reminder timing recalculated from '||NEW.scheduled_start,'confirmed',false));
 UPDATE crm_threads SET data=d WHERE id=t.id;
 UPDATE crm_outbox SET status='suppressed',reason='Verified canonical booking' WHERE thread_id=t.id AND status='queued' AND purpose='inquiry';
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER crm_booking_observer AFTER INSERT OR UPDATE OF scheduled_start,status ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION public.crm_booking_observer();

CREATE FUNCTION public.crm_execute(p_location uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
<<crm_action>>
DECLARE
 l crm_locations%ROWTYPE; t crm_threads%ROWTYPE; d jsonb; a crm_actions%ROWTYPE;
 k text:=p_command->>'kind'; txt text:=trim(COALESCE(p_command->>'text','')); v_key text:=p_command->>'key';
 s crm_evaluation_openings%ROWTYPE; b bookings%ROWTYPE; o crm_outbox%ROWTYPE;
 snap jsonb; sim boolean; reason text; ev jsonb; now_local int; wf jsonb;
 v_author text:=CASE WHEN p_command->>'source'='agent' THEN 'agent' ELSE 'staff' END;
BEGIN
 SELECT * INTO l FROM crm_locations WHERE location_id=p_location;
 IF NOT FOUND OR NOT COALESCE(crm_can_access(l.tenant_id,p_location),false) THEN RAISE EXCEPTION 'Location not authorized'; END IF;
 IF NULLIF(trim(v_key),'') IS NULL OR length(v_key)>200 THEN RAISE EXCEPTION 'Stable action key required'; END IF;
 -- Same lock order as the scheduler; survives restarts, coordinates phone/SMS/staff.
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||l.tenant_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm:'||p_location::text,0));
 SELECT * INTO a FROM crm_actions WHERE location_id=p_location AND key=v_key;
 IF FOUND THEN
  IF a.payload IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'Action key reused with different arguments'; END IF;
  RETURN crm_snapshot(p_location);
 END IF;
 sim:=l.connection='simulated';
 IF v_author='agent' AND k NOT IN ('find_slots','offer_slots','save_sms','book','send','dispatch','reconcile','callback') THEN
  RAISE EXCEPTION 'Assistant action not authorized'; END IF;
 IF k='workflow' THEN
  IF txt='' OR txt~'\[[^]]*\]|\{\{' OR length(txt)>1600
    OR COALESCE((p_command->>'delay_minutes')::int,0) NOT BETWEEN 1 AND 43200
    OR COALESCE(p_command->>'authority','') NOT IN ('draft','delegated') THEN RAISE EXCEPTION 'Valid wording, delay and authority required'; END IF;
  IF p_command->>'authority'='delegated' AND NOT sim THEN RAISE EXCEPTION 'Delegation is isolated-preview only'; END IF;
  wf:=l.workflow||jsonb_build_object('version',(l.workflow->>'version')::int+1,'wording',txt,
   'delay_minutes',(p_command->>'delay_minutes')::int,'enabled',COALESCE((p_command->>'enabled')::boolean,false),
   'authority',p_command->>'authority','history',(l.workflow->'history')||jsonb_build_object('at',now(),'actor',auth.uid(),'version',(l.workflow->>'version')::int+1,'reason','Staff version saved; active runs retain wording and version'));
  UPDATE crm_locations SET workflow=wf WHERE location_id=p_location;
  -- Pause suppresses queued automation; resume never releases an old queue.
  IF NOT (wf->>'enabled')::boolean THEN UPDATE crm_outbox SET status='suppressed',reason='Workflow paused' WHERE location_id=p_location AND author<>'staff' AND status='queued'; END IF;
 ELSIF k='tick' THEN
  FOR t IN SELECT * FROM crm_threads WHERE location_id=p_location AND data->'nurture'->>'status'='waiting'
    AND (data->'nurture'->>'due')::timestamptz<=now() FOR UPDATE LOOP
   d:=t.data; reason:=NULL;
   IF d->'booking'<>'null'::jsonb THEN reason:='Verified booking';
   ELSIF d->>'hold' IS NOT NULL THEN reason:=d->>'hold';
   ELSIF NOT (l.workflow->>'enabled')::boolean THEN reason:='Workflow paused';
   ELSIF NOT (d->>'consent')::boolean OR NOT (d->>'verified')::boolean THEN reason:='Consent or guardian verification required';
   END IF;
   IF reason IS NULL THEN
    INSERT INTO crm_outbox(tenant_id,location_id,thread_id,logical_key,revision,author,body)
    VALUES(l.tenant_id,p_location,t.id,'nurture:'||t.id,(d->>'revision')::int,'workflow',d->'nurture'->>'wording') ON CONFLICT DO NOTHING;
    reason:='Prepared once; dispatch rechecks eligibility';
   END IF;
   UPDATE crm_threads SET data=jsonb_set(jsonb_set(d,'{nurture,status}','"review"'),'{nurture,reason}',to_jsonb(reason))
    ||jsonb_build_object('events',(d->'events')||crm_event('workflow','workflow',reason,'review',sim)) WHERE id=t.id;
  END LOOP;
 ELSE
  SELECT * INTO t FROM crm_threads WHERE id=(p_command->>'thread_id')::uuid AND location_id=p_location FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  d:=t.data;
  IF v_author='agent' AND k IN ('book','send') AND
   (NOT sim OR NOT (l.workflow->>'enabled')::boolean OR l.workflow->>'authority'<>'delegated'
    OR d->>'hold' IS NOT NULL OR NOT (d->>'consent')::boolean OR NOT (d->>'verified')::boolean)
  THEN RAISE EXCEPTION 'Delegated authority denied at action boundary'; END IF;
  IF k NOT IN ('dispatch','reconcile') AND (p_command->>'revision')::int IS DISTINCT FROM (d->>'revision')::int THEN
   RAISE EXCEPTION 'Conversation changed. Reload and review your draft.'; END IF;
  CASE k
  WHEN 'save_sms' THEN d:=jsonb_set(d,'{sms_draft}',to_jsonb(left(txt,1600)));
  WHEN 'save_note' THEN d:=jsonb_set(d,'{note_draft}',to_jsonb(left(txt,4000)));
  WHEN 'note' THEN
   IF txt='' THEN RAISE EXCEPTION 'Note required'; END IF;
   d:=d||jsonb_build_object('note_draft','','events',(d->'events')||crm_event('private note','staff',left(txt,4000),'saved',sim));
  WHEN 'consent' THEN
   IF txt='' THEN RAISE EXCEPTION 'Document channel, purpose and permission source'; END IF;
   IF d->>'hold'='STOP' THEN RAISE EXCEPTION 'STOP requires separately approved re-opt-in; cannot be cleared here'; END IF;
   IF COALESCE(p_command->>'channel','sms') NOT IN ('sms','voice') THEN RAISE EXCEPTION 'Unknown consent channel'; END IF;
   d:=d||jsonb_build_object(CASE WHEN p_command->>'channel'='voice' THEN 'voice_consent' ELSE 'consent' END,true,
    'events',(d->'events')||crm_event('permission','staff',txt,COALESCE(p_command->>'channel','sms')||' inquiry permission recorded',sim));
  WHEN 'resolve' THEN
   IF txt='' THEN RAISE EXCEPTION 'Guardian verification evidence required'; END IF;
   IF p_command ? 'parent_name' OR p_command ? 'athlete_name' OR p_command ? 'athlete_age' THEN
    IF NULLIF(trim(p_command->>'parent_name'),'') IS NULL OR length(p_command->>'parent_name')>120
     OR NULLIF(trim(p_command->>'athlete_name'),'') IS NULL OR length(p_command->>'athlete_name')>120
     OR NOT COALESCE((p_command->>'athlete_age')::int BETWEEN 1 AND 120,false)
     THEN RAISE EXCEPTION 'Verified parent, athlete and valid age required'; END IF;
    d:=d||jsonb_build_object('parent',trim(p_command->>'parent_name'),'athlete',trim(p_command->>'athlete_name'),'age',(p_command->>'athlete_age')::int);
   END IF;
   IF p_command->>'recipient_timezone' IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_command->>'recipient_timezone') THEN RAISE EXCEPTION 'Valid recipient timezone required'; END IF;
    d:=jsonb_set(d,'{recipient_timezone}',to_jsonb(p_command->>'recipient_timezone'));
   END IF;
   IF (p_command->>'verified_family_id' IS NULL)<>(p_command->>'verified_kid_id' IS NULL) THEN
    RAISE EXCEPTION 'Select both canonical family and athlete, or leave both unlinked'; END IF;
   IF p_command->>'verified_family_id' IS NOT NULL THEN
    IF t.kid_id IS NOT NULL AND t.kid_id<>(p_command->>'verified_kid_id')::uuid
     AND EXISTS(SELECT 1 FROM bookings WHERE crm_prospect_id=t.id AND status IN ('confirmed','completed'))
     THEN RAISE EXCEPTION 'A booked athlete cannot be silently switched to a sibling; use native booking correction'; END IF;
    IF NOT EXISTS(SELECT 1 FROM families f JOIN kids c ON c.family_id=f.id WHERE f.id=(p_command->>'verified_family_id')::uuid AND c.id=(p_command->>'verified_kid_id')::uuid AND f.tenant_id=l.tenant_id AND f.primary_location_id=p_location)
    THEN RAISE EXCEPTION 'Canonical family and athlete must match this location'; END IF;
    UPDATE crm_threads SET family_id=(p_command->>'verified_family_id')::uuid,kid_id=(p_command->>'verified_kid_id')::uuid WHERE id=t.id;
   END IF;
   d:=d||jsonb_build_object('verified',true,'events',(d->'events')||crm_event('identity','staff',txt,'guardian verified; no outreach permission inferred',sim));
  WHEN 'takeover' THEN
   IF d->>'hold' IS DISTINCT FROM 'STOP' THEN d:=jsonb_set(d,'{hold}','"human"'); END IF;
   d:=d||jsonb_build_object('owner',auth.uid(),'events',(d->'events')||crm_event('handoff','staff','Staff took over. Unsent assistant activity paused.','held',sim));
   IF d->'callback'<>'null'::jsonb THEN d:=jsonb_set(d,'{callback,owner}',to_jsonb(auth.uid()::text)); END IF;
   UPDATE crm_outbox SET status='suppressed',reason='Staff takeover' WHERE thread_id=t.id AND author<>'staff' AND status='queued';
  WHEN 'callback' THEN
   IF d->'callback'='null'::jsonb THEN
    d:=d||jsonb_build_object('callback',jsonb_build_object('id',gen_random_uuid(),'reason',COALESCE(NULLIF(txt,''),'Parent requests coach'),'question',(SELECT e->>'body' FROM jsonb_array_elements(d->'events') e WHERE e->>'author'='parent' ORDER BY e->>'at' DESC LIMIT 1),'due',now()+interval '1 hour','status','due','owner',auth.uid()));
   END IF;
   IF d->>'hold' IS DISTINCT FROM 'STOP' THEN d:=jsonb_set(d,'{hold}','"human"'); END IF;
   d:=jsonb_set(d,'{callback,owner}',to_jsonb(auth.uid()::text));
   IF v_author='staff' AND txt<>'' THEN d:=jsonb_set(d,'{callback,reason}',to_jsonb(txt)); END IF;
   IF d->'callback'->>'status'='unassigned' THEN d:=jsonb_set(d,'{callback,status}','"due"'); END IF;
   d:=d||jsonb_build_object('owner',auth.uid(),'events',(d->'events')||crm_event('callback',v_author,'One assigned coach callback retained; unsent automation paused.','assigned',sim));
   UPDATE crm_outbox SET status='suppressed',reason='Coach callback' WHERE thread_id=t.id AND author<>'staff' AND status='queued';
  WHEN 'find_slots' THEN
   snap:=crm_snapshot(p_location);
   d:=d||jsonb_build_object('offered',(SELECT COALESCE(jsonb_agg(v->>'id'),'[]') FROM jsonb_array_elements(snap->'slots') v WHERE (v->>'available')::boolean),
    'events',(d->'events')||crm_event('availability','staff','Eligible facility openings inspected; no reservation made.','draft',sim));
  WHEN 'offer_slots' THEN
   snap:=crm_snapshot(p_location);
   SELECT string_agg(to_char((v->>'starts_at')::timestamptz AT TIME ZONE l.timezone,'Dy Mon DD HH24:MI'),' or '),
    COALESCE(jsonb_agg(v->>'id'),'[]') INTO txt,ev FROM jsonb_array_elements(snap->'slots') v WHERE (v->>'available')::boolean;
   IF txt IS NULL THEN RAISE EXCEPTION 'No eligible openings. Ask staff to configure availability.'; END IF;
   d:=d||jsonb_build_object('offered',ev,'sms_draft','Available evaluations: '||txt||' ('||l.timezone||'). Which works for you?');
  WHEN 'select_slot' THEN
   IF NOT sim THEN RAISE EXCEPTION 'Controlled parent selection is preview only'; END IF;
   IF NOT (d->'offered') ? (p_command->>'slot_id') THEN RAISE EXCEPTION 'Select an offered opening'; END IF;
   d:=d||jsonb_build_object('selection',p_command->>'slot_id','events',(d->'events')||crm_event('parent SMS','parent','I choose the offered opening.','simulated inbound selection',true));
  WHEN 'book' THEN
   IF NOT (d->>'verified')::boolean THEN RAISE EXCEPTION 'Resolve guardian ambiguity before booking'; END IF;
   IF v_author='agent' AND (d->>'selection' IS NULL OR d->>'selection' IS DISTINCT FROM p_command->>'slot_id') THEN RAISE EXCEPTION 'Parent selection required'; END IF;
   IF t.kid_id IS NOT NULL AND EXISTS(SELECT 1 FROM memberships WHERE kid_id=t.kid_id AND tenant_id=l.tenant_id AND status='active') THEN
    RAISE EXCEPTION 'Enrolled athlete: use the existing entitled booking path. CRM will observe its booking.'; END IF;
    SELECT existing.* INTO b FROM bookings existing
     WHERE existing.crm_prospect_id=t.id AND existing.tenant_id=l.tenant_id AND existing.location_id=p_location
      AND existing.status IN ('confirmed','completed')
      AND EXISTS(SELECT 1 FROM crm_evaluation_services es WHERE es.tenant_id=existing.tenant_id
       AND es.location_id=existing.location_id AND es.session_type_id=existing.session_type_id);
    IF NOT FOUND AND t.kid_id IS NOT NULL THEN
     SELECT existing.* INTO b FROM bookings existing
      WHERE existing.kid_id=t.kid_id AND existing.tenant_id=l.tenant_id AND existing.location_id=p_location
       AND existing.status='confirmed' AND existing.scheduled_start>now()
       AND EXISTS(SELECT 1 FROM crm_evaluation_services es WHERE es.tenant_id=existing.tenant_id
        AND es.location_id=existing.location_id AND es.session_type_id=existing.session_type_id)
      ORDER BY existing.scheduled_start LIMIT 1;
    END IF;
   IF b.id IS NULL THEN
    SELECT * INTO s FROM crm_evaluation_openings WHERE id=(p_command->>'slot_id')::uuid AND location_id=p_location;
    snap:=crm_snapshot(p_location);
    IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(snap->'slots') v WHERE v->>'id'=s.id::text AND (v->>'available')::boolean) THEN RAISE EXCEPTION 'Opening no longer available. Refresh for current alternatives.'; END IF;
    -- This is an explicitly reviewed prospect evaluation, NOT a paid lesson
    -- or membership entitlement. Shared reservation triggers enforce resources.
    INSERT INTO bookings(tenant_id,location_id,kid_id,crm_prospect_id,coach_id,session_type_id,scheduled_start,scheduled_end,cage_number,status,notes)
    VALUES(l.tenant_id,p_location,t.kid_id,t.id,s.coach_id,s.session_type_id,s.starts_at,s.ends_at,s.cage_number,'confirmed','Staff CRM prospect evaluation') RETURNING * INTO b;
   END IF;
   SELECT data INTO d FROM crm_threads WHERE id=t.id; -- authoritative booking observer
   d:=d||jsonb_build_object('stage','Evaluation booked','booking',jsonb_build_object('id',b.id,'starts_at',b.scheduled_start,'status',b.status),
    'nurture',(d->'nurture')||jsonb_build_object('status','stopped','reason','Verified canonical booking '||b.id),
    'sms_draft','Your evaluation is confirmed for '||to_char(b.scheduled_start AT TIME ZONE l.timezone,'Dy Mon DD HH24:MI')||' ('||l.timezone||').');
  WHEN 'send' THEN
   IF txt='' OR txt~'\[[^]]*\]|\{\{' OR length(txt)>1600 THEN RAISE EXCEPTION 'Blank or unresolved SMS rejected'; END IF;
   IF EXISTS(SELECT 1 FROM crm_outbox WHERE thread_id=t.id AND body=txt AND status='unknown') THEN
    RAISE EXCEPTION 'Previous send outcome unknown; reconcile before another attempt'; END IF;
   INSERT INTO crm_outbox(tenant_id,location_id,thread_id,logical_key,revision,author,body,purpose)
   VALUES(l.tenant_id,p_location,t.id,CASE WHEN v_author='agent' AND d->'booking'<>'null'::jsonb THEN 'confirmation:'||(d->'booking'->>'id') ELSE v_key END,
   (d->>'revision')::int+1,v_author,txt,CASE WHEN d->'booking'<>'null'::jsonb THEN 'confirmation' ELSE 'inquiry' END) ON CONFLICT DO NOTHING;
   d:=d||jsonb_build_object('sms_draft','','events',(d->'events')||crm_event('parent SMS',v_author,txt,'queued for permission check; not delivered',sim));
  WHEN 'assist' THEN
   -- The model runner is external to this transaction; missing model is a
   -- durable human handoff, never a fabricated assistant answer.
   d:=d||jsonb_build_object('events',(d->'events')||crm_event('assistant','agent','Model unavailable. Manual reply and scheduling remain available.','staff review required',sim));
   IF d->'callback'='null'::jsonb THEN d:=d||jsonb_build_object('callback',jsonb_build_object('id',gen_random_uuid(),'reason','Assistant unavailable','question','Review latest parent question','due',now()+interval '1 hour','status','due','owner',auth.uid())); END IF;
  WHEN 'call' THEN
   IF l.connection='missing' THEN RAISE EXCEPTION 'Location phone connection missing; no call placed'; END IF;
   IF NOT sim THEN RAISE EXCEPTION 'Staff-only Twilio rehearsal not activated'; END IF;
   IF NOT (d->>'verified')::boolean OR NOT COALESCE((d->>'voice_consent')::boolean,false) OR d->>'hold'='STOP' THEN RAISE EXCEPTION 'Verified guardian voice permission required'; END IF;
   IF l.dispatch_policy IS NULL OR NULLIF(d->>'recipient_timezone','') IS NULL THEN RAISE EXCEPTION 'Approved voice timing and recipient timezone required'; END IF;
   IF extract(hour FROM now() AT TIME ZONE l.timezone) NOT BETWEEN (l.dispatch_policy->>'start_hour')::int AND (l.dispatch_policy->>'end_hour')::int-1
    OR extract(hour FROM now() AT TIME ZONE (d->>'recipient_timezone')) NOT BETWEEN (l.dispatch_policy->>'start_hour')::int AND (l.dispatch_policy->>'end_hour')::int-1
    OR (SELECT count(*) FROM crm_outbox WHERE location_id=p_location AND thread_id=t.id AND attempted_at>now()-interval '24 hours')>=(l.dispatch_policy->>'daily_cap')::int
    THEN RAISE EXCEPTION 'Call timing or contact cap blocked'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(d->'events') e WHERE e->>'kind'='call' AND e->>'status'='initiated') THEN RAISE EXCEPTION 'Call already active'; END IF;
   INSERT INTO crm_outbox(tenant_id,location_id,thread_id,logical_key,revision,author,body,purpose,status,provider_sid,attempted_at)
   VALUES(l.tenant_id,p_location,t.id,v_key,(d->>'revision')::int,'staff','Staff call','call','initiated','SIM-CALL-'||v_key,now());
   d:=d||jsonb_build_object('events',(d->'events')||crm_event('call','staff','Staff call from '||l.sender,'initiated',true));
  WHEN 'call_outcome' THEN
   IF p_command->>'outcome' NOT IN ('completed','no-answer','busy','failed') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'events') e WHERE e->>'kind'='call' AND e->>'status'='initiated') THEN RAISE EXCEPTION 'Active call and valid outcome required'; END IF;
   d:=d||jsonb_build_object('events',(SELECT jsonb_agg(CASE WHEN e->>'kind'='call' AND e->>'status'='initiated' THEN e||jsonb_build_object('status',p_command->>'outcome') ELSE e END) FROM jsonb_array_elements(d->'events') e));
   UPDATE crm_outbox SET status=p_command->>'outcome' WHERE thread_id=t.id AND purpose='call' AND status='initiated';
   IF d->'callback'<>'null'::jsonb THEN d:=jsonb_set(d,'{callback,status}',to_jsonb(CASE WHEN p_command->>'outcome'='completed' THEN 'complete' ELSE 'due' END)); END IF;
  WHEN 'dispatch' THEN
   FOR o IN SELECT * FROM crm_outbox WHERE thread_id=t.id AND status='queued' ORDER BY created_at FOR UPDATE LOOP
    reason:=NULL;
    IF d->>'hold'='STOP' THEN reason:='STOP suppression';
    ELSIF NOT (d->>'verified')::boolean THEN reason:='Guardian unresolved';
    ELSIF NOT (d->>'consent')::boolean THEN reason:='Missing SMS inquiry consent';
    ELSIF o.author<>'staff' AND d->>'hold' IS NOT NULL THEN reason:='Human hold';
    ELSIF o.revision<>(d->>'revision')::int THEN reason:='Thread revision changed; review required';
    ELSIF o.purpose='inquiry' AND d->'booking'<>'null'::jsonb THEN reason:='Verified booking stopped sales nurture';
    ELSIF o.author<>'staff' AND (NOT (l.workflow->>'enabled')::boolean OR l.workflow->>'authority'<>'delegated') THEN reason:='Draft authority; explicit staff review required';
    ELSIF l.connection='missing' THEN reason:='Location connection missing; draft retained';
    ELSIF NOT sim THEN reason:='Real outbound transport not activated; draft retained';
    ELSIF NULLIF(d->>'recipient_timezone','') IS NULL THEN reason:='Recipient timezone unresolved';
    ELSIF l.dispatch_policy IS NULL THEN reason:='Approved location dispatch policy required';
    ELSIF extract(hour FROM now() AT TIME ZONE l.timezone) NOT BETWEEN (l.dispatch_policy->>'start_hour')::int AND (l.dispatch_policy->>'end_hour')::int-1
      OR extract(hour FROM now() AT TIME ZONE (d->>'recipient_timezone')) NOT BETWEEN (l.dispatch_policy->>'start_hour')::int AND (l.dispatch_policy->>'end_hour')::int-1 THEN reason:='Outside approved local timing';
    ELSIF (SELECT count(*) FROM crm_outbox WHERE location_id=p_location AND thread_id=t.id AND attempted_at>now()-interval '24 hours')>=(l.dispatch_policy->>'daily_cap')::int THEN reason:='Location daily contact cap';
    ELSIF o.body='' OR o.body~'\[[^]]*\]|\{\{' THEN reason:='Unresolved SMS content';
    END IF;
    IF reason IS NOT NULL THEN
     UPDATE crm_outbox SET status='suppressed',reason=crm_action.reason WHERE id=o.id;
     d:=d||jsonb_build_object('events',(d->'events')||crm_event('dispatch',o.author,reason,'suppressed; draft retained',sim),'sms_draft',o.body);
    ELSE
     -- Durable attempt before provider effects. This slice permits only the
     -- non-delivering double; uncertain real transport is never blindly retried.
     UPDATE crm_outbox SET status=CASE WHEN sim THEN 'accepted' ELSE 'unknown' END,provider_sid='SIM-'||id,attempted_at=now(),reason='Non-delivering adapter' WHERE id=o.id;
     d:=d||jsonb_build_object('events',(d->'events')||crm_event('parent SMS',o.author,o.body,CASE WHEN sim THEN 'simulated provider accepted — not delivered' ELSE 'unknown — reconcile, do not retry' END,sim));
    END IF;
   END LOOP;
  WHEN 'reconcile' THEN
   SELECT * INTO b FROM bookings WHERE crm_prospect_id=t.id AND status='confirmed';
   IF FOUND THEN d:=d||jsonb_build_object('booking',jsonb_build_object('id',b.id,'starts_at',b.scheduled_start,'status',b.status),'stage','Evaluation booked'); END IF;
   d:=d||jsonb_build_object('events',(d->'events')||crm_event('reconciliation','staff',CASE WHEN b.id IS NULL THEN 'No committed evaluation found; unknown sends remain held.' ELSE 'Authoritative booking found: '||b.id END,'checked',sim));
  ELSE RAISE EXCEPTION 'Unsupported CRM action';
  END CASE;
  d:=jsonb_set(d,'{revision}',to_jsonb((d->>'revision')::int+1));
  IF d->>'stage'='New inquiry' AND k IN ('send','callback','takeover') THEN d:=jsonb_set(d,'{stage}','"In follow-up"'); END IF;
  UPDATE crm_threads SET data=d WHERE id=t.id;
 END IF;
 INSERT INTO crm_actions(tenant_id,location_id,key,thread_id,payload,actor,result) VALUES(l.tenant_id,p_location,v_key,t.id,p_command,auth.uid(),
  jsonb_build_object('thread_revision',d->'revision','booking',d->'booking','kind',k));
 INSERT INTO crm_activity(tenant_id,location_id,thread_id,actor,kind,evidence) VALUES(l.tenant_id,p_location,t.id,auth.uid(),k,p_command-'text');
 RETURN crm_snapshot(p_location);
END; $$;

REVOKE ALL ON FUNCTION public.crm_can_access(uuid,uuid),public.crm_snapshot(uuid),public.crm_execute(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_can_access(uuid,uuid),public.crm_snapshot(uuid),public.crm_execute(uuid,jsonb) TO authenticated;
COMMIT;
