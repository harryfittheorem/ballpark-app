DO $$ BEGIN
  IF (SELECT count(*) FROM retention_coverage) <> 2 THEN RAISE EXCEPTION 'missing coverage'; END IF;
  IF (SELECT count(*) FROM retention_membership_history WHERE source='baseline') <> 2 THEN RAISE EXCEPTION 'missing baseline'; END IF;
  IF EXISTS(SELECT 1 FROM retention_membership_history WHERE effective_at < (SELECT min(started_at) FROM retention_coverage)) THEN RAISE EXCEPTION 'invented backfill'; END IF;
  IF (SELECT state->>'division' FROM retention_segment_history WHERE kid_id='30000000-0000-0000-0000-000000000001') <> 'High School' THEN RAISE EXCEPTION 'division label'; END IF;
  IF EXISTS(SELECT 1 FROM retention_segment_history WHERE state ? 'date_of_birth') THEN RAISE EXCEPTION 'unnecessary DOB storage'; END IF;
END $$;
UPDATE memberships SET amount_cents=29000 WHERE id='40000000-0000-0000-0000-000000000001';
UPDATE kids SET date_of_birth='2010-02-02' WHERE id='30000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT count(*) FROM retention_membership_history) <> 2 THEN RAISE EXCEPTION 'non-reporting membership noise'; END IF;
  IF (SELECT count(*) FROM retention_segment_history) <> 2 THEN RAISE EXCEPTION 'DOB must not recalculate classifications'; END IF;
END $$;
UPDATE kids SET age_group='College' WHERE id='30000000-0000-0000-0000-000000000001';
UPDATE families SET primary_location_id='10000000-0000-0000-0000-000000000002' WHERE id='20000000-0000-0000-0000-000000000001';
UPDATE memberships SET status='cancelled',cancel_effective_at=now()+interval '1 day' WHERE id='40000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT count(*) FROM retention_segment_history) <> 4 THEN RAISE EXCEPTION 'missing override or transfer observation'; END IF;
  IF NOT EXISTS(SELECT 1 FROM retention_segment_history WHERE state->>'division'='High School') THEN RAISE EXCEPTION 'old classification rewritten'; END IF;
  IF NOT EXISTS(SELECT 1 FROM retention_membership_history WHERE state->>'status'='active') THEN RAISE EXCEPTION 'old lifecycle overwritten'; END IF;
  BEGIN UPDATE retention_segment_history SET state='{}'; RAISE EXCEPTION 'history mutated';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'history mutated' THEN RAISE; END IF; END;
  BEGIN DELETE FROM retention_membership_history; RAISE EXCEPTION 'history erased';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'history erased' THEN RAISE; END IF; END;
END $$;
DELETE FROM memberships WHERE id='40000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM retention_membership_history WHERE state->>'deleted'='true') THEN RAISE EXCEPTION 'missing deletion tombstone'; END IF;
  BEGIN
    INSERT INTO retention_policies(tenant_id,policy) VALUES ('00000000-0000-0000-0000-000000000001','{}');
    RAISE EXCEPTION 'missing approval accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SET ROLE authenticated;
SET test.claims='{"app_role":"owner","tenant_id":"00000000-0000-0000-0000-000000000001"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM retention_membership_history) <> 3 THEN RAISE EXCEPTION 'owner visibility wrong'; END IF;
  IF EXISTS(SELECT 1 FROM retention_membership_history WHERE tenant_id='00000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'cross tenant leak'; END IF;
  BEGIN INSERT INTO retention_coverage(tenant_id) VALUES ('00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'client write permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET test.claims='{"app_role":"coach","tenant_id":"00000000-0000-0000-0000-000000000001"}';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM retention_membership_history) THEN RAISE EXCEPTION 'coach access leak'; END IF; END $$;
-- A claimed role without the authoritative row is not enough.
SET test.claims='{"app_role":"super_admin"}';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM retention_membership_history) THEN RAISE EXCEPTION 'unverified network leak'; END IF; END $$;
SET test.uid='60000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT count(*) FROM retention_membership_history) <> 4 THEN RAISE EXCEPTION 'verified network access denied'; END IF; END $$;
RESET ROLE;
SELECT 'retention SQL assertions passed';
