-- Isolated schema fixture: source columns match the relevant app migrations.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('test.claims',true),''),'{}')::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.uid',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
CREATE TABLE tenants(id uuid PRIMARY KEY);
CREATE TABLE locations(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),name text,timezone text);
CREATE TABLE families(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),primary_location_id uuid REFERENCES locations(id));
CREATE TABLE kids(id uuid PRIMARY KEY,family_id uuid REFERENCES families(id),age_group text,date_of_birth date);
CREATE TABLE memberships(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),kid_id uuid REFERENCES kids(id),
  status text,started_at timestamptz,cancelled_at timestamptz,cancel_effective_at timestamptz,expires_at timestamptz,amount_cents integer);
CREATE TABLE super_admins(id uuid PRIMARY KEY,user_id uuid);
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admins_select ON super_admins FOR SELECT TO authenticated
  USING ((auth.jwt()->>'app_role')='super_admin');
GRANT SELECT ON super_admins TO authenticated;
INSERT INTO tenants VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
INSERT INTO locations VALUES
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Fixture One','America/New_York'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Fixture Two','America/New_York'),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Fixture Other','UTC');
INSERT INTO families VALUES
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003');
INSERT INTO kids VALUES
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','HS','2010-01-01'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','8U','2020-01-01');
INSERT INTO memberships VALUES
('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','active','2020-01-01',NULL,NULL,NULL,28000),
('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','active','2020-01-01',NULL,NULL,NULL,28000);
INSERT INTO super_admins VALUES ('50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001');
