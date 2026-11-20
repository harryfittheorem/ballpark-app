-- Minimal isolated fixture, never run against an application database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE PUBLICATION supabase_realtime;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid; $$;
CREATE TABLE tenants(id uuid PRIMARY KEY,slug text);
CREATE TABLE locations(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),name text);
ALTER TABLE locations ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
CREATE TABLE families(id uuid PRIMARY KEY,tenant_id uuid,parent_user_id uuid,primary_location_id uuid);
CREATE TABLE kids(id uuid PRIMARY KEY,family_id uuid,first_name text,last_name text,points_balance integer DEFAULT 0);
CREATE TABLE coaches(id uuid PRIMARY KEY,tenant_id uuid,user_id uuid,first_name text,last_name text,is_active boolean DEFAULT true,capabilities jsonb DEFAULT '{"preset":"instructor"}');
CREATE TABLE coach_locations(coach_id uuid,location_id uuid);
CREATE TABLE coach_availability(coach_id uuid,tenant_id uuid,day_of_week integer,start_time time,end_time time,effective_from date,effective_until date,
  location_id uuid NOT NULL DEFAULT '20000000-0000-0000-0000-000000000001',is_recurring boolean NOT NULL DEFAULT true);
CREATE TABLE staff_locations(user_id uuid,location_id uuid);
CREATE TABLE session_types(id uuid PRIMARY KEY,tenant_id uuid,name text,type_category text,duration_minutes integer,capacity integer DEFAULT 1,is_active boolean DEFAULT true);
CREATE TABLE bookings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,location_id uuid,kid_id uuid,coach_id uuid NOT NULL,
 session_type_id uuid,scheduled_start timestamptz,scheduled_end timestamptz,cage_number text,
 notes text,status text,attended_at timestamptz,cancelled_at timestamptz,cancellation_reason text,updated_at timestamptz,
 is_guest boolean DEFAULT false,guest_name text,guest_phone text,guest_email text
);
CREATE TABLE memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,kid_id uuid,plan_name text,
 plan_type text,status text,sessions_remaining integer,started_at timestamptz DEFAULT now(),updated_at timestamptz,
 sessions_per_week integer,weekly_sessions_used integer DEFAULT 0,weekly_period_start date);
CREATE TABLE sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid,tenant_id uuid,kid_id uuid,coach_id uuid,capture_source text,started_at timestamptz,ended_at timestamptz);
CREATE TABLE assignments(kid_id uuid,status text);
CREATE TABLE points_ledger(kid_id uuid,reference_type text,reference_id uuid,reason text,delta integer,tenant_id uuid,balance_after integer);
CREATE TABLE tenant_config(tenant_id uuid,booking_cancel_window_hours integer,booking_cancel_fee_cents integer);
INSERT INTO tenant_config VALUES('10000000-0000-0000-0000-000000000001',24,0);
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

INSERT INTO tenants VALUES('10000000-0000-0000-0000-000000000001','one'),('10000000-0000-0000-0000-000000000002','two');
INSERT INTO auth.users VALUES('90000000-0000-0000-0000-000000000001'),('90000000-0000-0000-0000-000000000002'),('90000000-0000-0000-0000-000000000003');
INSERT INTO locations(id,tenant_id,name) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Home'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Other location'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Other tenant');
INSERT INTO families VALUES('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001');
INSERT INTO kids VALUES
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Test','Athlete',0),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','Other','Athlete',0);
INSERT INTO coaches(id,tenant_id,user_id,first_name,last_name) VALUES
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','First','Coach'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',NULL,'Second','Coach'),
 ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002',NULL,'Outside','Coach');
INSERT INTO coach_locations VALUES
 ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
INSERT INTO staff_locations VALUES('90000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
INSERT INTO session_types(id,tenant_id,name,type_category,duration_minutes) VALUES
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Hitting Lesson','private',60),
 ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Cage Rental','cage',60),
 ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Clinic','group',60);
INSERT INTO memberships(tenant_id,kid_id,plan_type,status,sessions_remaining) VALUES
 ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','otc','active',30);
