-- Prospective retention evidence, not a reconstructed historical cohort.
-- No business policy is approved by this migration. See docs/RETENTION_CONTRACT.md.
BEGIN;

CREATE TABLE public.retention_coverage (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.retention_reporting_locations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  timezone text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  policy jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (policy ?& ARRAY['approvalReference','version','effectiveFrom']),
  CHECK (length(trim(policy->>'approvalReference')) > 0),
  CHECK (length(trim(policy->>'version')) > 0),
  CHECK ((policy->>'effectiveFrom')::timestamptz >= recorded_at)
);
CREATE TABLE public.retention_membership_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  membership_id uuid NOT NULL,
  kid_id uuid NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL,
  state jsonb NOT NULL,
  actor_id uuid DEFAULT auth.uid()
);
CREATE TABLE public.retention_segment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kid_id uuid NOT NULL,
  location_id uuid,
  effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL,
  state jsonb NOT NULL,
  actor_id uuid DEFAULT auth.uid()
);
CREATE INDEX ON public.retention_membership_history (tenant_id, membership_id, effective_at, recorded_at);
CREATE INDEX ON public.retention_segment_history (tenant_id, kid_id, effective_at, recorded_at);
CREATE UNIQUE INDEX retention_policy_version ON public.retention_policies (tenant_id, (policy->>'version'));

-- The source row is copied only at observation time. A late edit cannot be
-- backdated into a closed reporting period. Do not persist names/DOB/payments.
CREATE FUNCTION public.retention_membership_state(j jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'status', j->'status', 'started_at', j->'started_at',
    'cancelled_at', j->'cancelled_at', 'cancel_effective_at', j->'cancel_effective_at',
    'expires_at', j->'expires_at'
  )
$$;
CREATE FUNCTION public.retention_segment_state(j jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'division', CASE WHEN j->>'age_group' = 'HS' THEN 'High School' ELSE j->>'age_group' END,
    'sport', j->'sport', 'gender', j->'gender', 'competition', j->'competition'
  )
$$;
CREATE FUNCTION public.retention_capture_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j jsonb; s jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN j := to_jsonb(OLD); ELSE j := to_jsonb(NEW); END IF;
  s := public.retention_membership_state(j);
  IF TG_OP = 'UPDATE' AND s = public.retention_membership_state(to_jsonb(OLD))
    AND NEW.tenant_id = OLD.tenant_id AND NEW.kid_id = OLD.kid_id THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.tenant_id <> OLD.tenant_id OR NEW.kid_id <> OLD.kid_id) THEN
    INSERT INTO public.retention_membership_history(tenant_id,membership_id,kid_id,source,state)
    VALUES (OLD.tenant_id,OLD.id,OLD.kid_id,'identity_change',public.retention_membership_state(to_jsonb(OLD)) || '{"deleted":true}');
  END IF;
  IF TG_OP = 'DELETE' THEN s := s || '{"deleted":true}'; END IF;
  INSERT INTO public.retention_membership_history(tenant_id,membership_id,kid_id,source,state)
  VALUES ((j->>'tenant_id')::uuid,(j->>'id')::uuid,(j->>'kid_id')::uuid,lower(TG_OP),s);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

CREATE FUNCTION public.retention_capture_kid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE f record;
BEGIN
  IF TG_OP = 'UPDATE'
    AND public.retention_segment_state(to_jsonb(NEW)) = public.retention_segment_state(to_jsonb(OLD))
    AND NEW.family_id = OLD.family_id THEN RETURN NEW; END IF;
  SELECT tenant_id, primary_location_id INTO f FROM public.families WHERE id = NEW.family_id;
  IF FOUND THEN
    INSERT INTO public.retention_segment_history(tenant_id,kid_id,location_id,source,state)
    VALUES (f.tenant_id,NEW.id,
      CASE WHEN EXISTS (SELECT 1 FROM public.locations WHERE id=f.primary_location_id AND tenant_id=f.tenant_id)
        THEN f.primary_location_id ELSE NULL END,
      lower(TG_OP),public.retention_segment_state(to_jsonb(NEW)));
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.retention_capture_family() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    INSERT INTO public.retention_segment_history(tenant_id,kid_id,location_id,source,state)
    SELECT OLD.tenant_id,k.id,NULL,'cross_tenant_move_unknown','{}'::jsonb
    FROM public.kids k WHERE k.family_id = NEW.id;
  END IF;
  IF NEW.primary_location_id IS NOT DISTINCT FROM OLD.primary_location_id
    AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN RETURN NEW; END IF;
  INSERT INTO public.retention_segment_history(tenant_id,kid_id,location_id,source,state)
  SELECT NEW.tenant_id,k.id,
    CASE WHEN EXISTS (SELECT 1 FROM public.locations WHERE id=NEW.primary_location_id AND tenant_id=NEW.tenant_id)
      THEN NEW.primary_location_id ELSE NULL END,
    'family_location_change',public.retention_segment_state(to_jsonb(k))
  FROM public.kids k WHERE k.family_id = NEW.id;
  RETURN NEW;
END $$;
CREATE FUNCTION public.retention_capture_location() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Freeze the reporting timezone, not the operational location settings.
    -- A new reporting-zone version needs explicit policy approval.
    RETURN NEW;
  END IF;
  INSERT INTO public.retention_reporting_locations(id,tenant_id,name,timezone)
  VALUES (NEW.id,NEW.tenant_id,NEW.name,NEW.timezone);
  INSERT INTO public.retention_coverage(tenant_id) VALUES (NEW.tenant_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- Lock against concurrent writes while taking the baseline and installing capture.
LOCK TABLE public.memberships, public.kids, public.families, public.locations IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.retention_coverage(tenant_id) SELECT id FROM public.tenants;
INSERT INTO public.retention_reporting_locations(id,tenant_id,name,timezone)
SELECT id,tenant_id,name,timezone FROM public.locations;
INSERT INTO public.retention_membership_history(tenant_id,membership_id,kid_id,source,state)
SELECT tenant_id,id,kid_id,'baseline',public.retention_membership_state(to_jsonb(m)) FROM public.memberships m;
INSERT INTO public.retention_segment_history(tenant_id,kid_id,location_id,source,state)
SELECT f.tenant_id,k.id,
  CASE WHEN EXISTS (SELECT 1 FROM public.locations l WHERE l.id=f.primary_location_id AND l.tenant_id=f.tenant_id)
    THEN f.primary_location_id ELSE NULL END,
  'baseline_current_classification',public.retention_segment_state(to_jsonb(k))
FROM public.kids k JOIN public.families f ON f.id=k.family_id;
CREATE TRIGGER retention_membership_capture AFTER INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.retention_capture_membership();
CREATE TRIGGER retention_kid_capture AFTER INSERT OR UPDATE ON public.kids
  FOR EACH ROW EXECUTE FUNCTION public.retention_capture_kid();
CREATE TRIGGER retention_family_capture AFTER UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.retention_capture_family();
CREATE TRIGGER retention_location_capture AFTER INSERT OR UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.retention_capture_location();

CREATE FUNCTION public.retention_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'Retention evidence is append-only; use a reviewed privacy or correction migration'; END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['retention_coverage','retention_reporting_locations','retention_policies','retention_membership_history','retention_segment_history'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format($policy$
      CREATE POLICY retention_authorized_read ON public.%I FOR SELECT TO authenticated USING (
        (auth.jwt()->>'app_role' = 'owner' AND tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid)
        OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
      )
    $policy$, t);
    EXECUTE format('CREATE TRIGGER retention_no_mutation BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.retention_immutable()',t);
  END LOOP;
END $$;
-- No callable SECURITY DEFINER capture endpoints.
REVOKE ALL ON FUNCTION public.retention_capture_membership(), public.retention_capture_kid(),
  public.retention_capture_family(), public.retention_capture_location() FROM PUBLIC, anon, authenticated;
COMMIT;
