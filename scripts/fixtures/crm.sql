-- Synthetic fixture ONLY, loaded by crm-preview.py into a private local DB.
SET request.jwt.claims='{"sub":"90000000-0000-0000-0000-000000000001","tenant_id":"10000000-0000-0000-0000-000000000001","app_role":"owner","role":"authenticated"}';
UPDATE locations SET timezone='America/New_York',name=CASE WHEN name='Home' THEN 'Clearwater • Rehearsal' ELSE 'Tampa • Rehearsal' END;
SELECT set_manual_location_capacity('20000000-0000-0000-0000-000000000001',1,1);
SELECT set_manual_location_capacity('20000000-0000-0000-0000-000000000002',1,1);
INSERT INTO scheduling_resources(tenant_id,location_id,cage_number,purpose)
SELECT tenant_id,id,'Evaluation cage','instruction' FROM locations WHERE tenant_id='10000000-0000-0000-0000-000000000001';
INSERT INTO crm_locations(location_id,tenant_id,timezone,sender,account_sid,credential_ref,connection)
SELECT id,tenant_id,'America/New_York',
 CASE WHEN name LIKE 'Clearwater%' THEN '+15005550006' ELSE '+15005550007' END,
 CASE WHEN name LIKE 'Clearwater%' THEN 'AC_SYNTH_CLEARWATER' ELSE 'AC_SYNTH_TAMPA' END,
 'isolated-signer','simulated' FROM locations WHERE tenant_id='10000000-0000-0000-0000-000000000001';
-- Deliberately synthetic rehearsal policy, not an approved live policy.
UPDATE crm_locations SET callback_owner=CASE WHEN location_id='20000000-0000-0000-0000-000000000001' THEN '90000000-0000-0000-0000-000000000001'::uuid ELSE '90000000-0000-0000-0000-000000000003'::uuid END,dispatch_policy='{"start_hour":8,"end_hour":21,"daily_cap":3,"approval":"synthetic rehearsal only"}';
INSERT INTO coach_availability(coach_id,tenant_id,location_id,day_of_week,start_time,end_time) VALUES(
 '50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',4,'17:00','21:00');
INSERT INTO families VALUES('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',NULL,'20000000-0000-0000-0000-000000000002');
INSERT INTO kids(id,family_id,first_name,last_name) VALUES('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','Sam','Diaz');
INSERT INTO staff_locations VALUES('90000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002');
INSERT INTO session_types(id,tenant_id,name,type_category,duration_minutes) VALUES(
 '60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Prospect evaluation • synthetic','private',60);
INSERT INTO crm_evaluation_services(location_id,tenant_id,session_type_id) VALUES(
 '20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004');
INSERT INTO crm_threads(id,tenant_id,location_id,phone,data)
SELECT x.id::uuid,'10000000-0000-0000-0000-000000000001',x.loc::uuid,x.phone,jsonb_build_object(
 'parent',x.parent,'athlete',x.athlete,'age',10,'stage','New inquiry','revision',0,'hold',NULL,
 'consent',true,'voice_consent',true,'verified',true,'recipient_timezone','America/New_York','owner',NULL,'sms_draft','','note_draft','',
 'selection',NULL,'booking',NULL,'callback',NULL,'offered','[]'::jsonb,
 'nurture',jsonb_build_object('status','waiting','reason','Synthetic permission and guardian evidence supplied by fixture, not inferred from inquiry','due',now()+interval '1 day','version',1,'wording','Would you like help finding an evaluation time?'),
 'events',jsonb_build_array(crm_event('parent SMS','parent',x.message,'simulated inbound',true),
 crm_event('permission','fixture','Synthetic guardian and SMS inquiry permission verified for isolated rehearsal.','fixture evidence',true)))
FROM (VALUES
 ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','+15005550101','Avery Morgan','Eli','Do you have an evaluation Thursday after 5 for my 10-year-old?'),
 ('70000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','+15005550102','Jordan Diaz','Sam','We would like an evaluation this week.'),
 ('70000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','+15005550103','Taylor Brooks','Alex','Could a coach call me?')
) x(id,loc,phone,parent,athlete,message);
INSERT INTO crm_evaluation_openings(id,tenant_id,location_id,session_type_id,coach_id,cage_number,starts_at,ends_at)
SELECT ('80000000-0000-0000-0000-00000000000'||i)::uuid,
 '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '60000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','Evaluation cage',
 ((date_trunc('week',now() AT TIME ZONE 'America/New_York')+interval '10 days 17 hours 30 minutes'+make_interval(hours=>i-1)) AT TIME ZONE 'America/New_York'),
 ((date_trunc('week',now() AT TIME ZONE 'America/New_York')+interval '10 days 18 hours 30 minutes'+make_interval(hours=>i-1)) AT TIME ZONE 'America/New_York')
FROM generate_series(1,2) i;
