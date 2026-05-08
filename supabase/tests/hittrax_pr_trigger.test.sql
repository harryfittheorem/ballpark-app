-- =============================================================================
-- Ballpark — task #118 invariants: HitTrax PR trigger + idempotency + safety
-- =============================================================================
-- The detect_swing_pr trigger (migration 20260508060000) is the contract that
-- a single new HitTrax-sourced swing:
--   1. UPSERTs personal_bests when its metric beats the existing PR.
--   2. Flips swings.is_personal_best to true on the new row.
--   3. Inserts exactly one points_ledger row with reason='pr_hit', delta=+15,
--      and bumps kids.points_balance by 15.
--   4. Is idempotent: a second insert with the same (capture_source,
--      capture_event_id) errors with unique_violation BEFORE the trigger
--      fires; even if the trigger were re-fired manually, the partial unique
--      on points_ledger.reference_id would absorb the duplicate ledger row
--      and the trigger gracefully refunds the kids.points_balance bump.
--   5. Forging tenant_id at insert-time can't smuggle PRs into another
--      tenant's ledger because the trigger reads tenant_id from NEW.
--
-- This file is a smoke test, not a full pgTAP suite — fixture rows are
-- created with random IDs in a transactional block that's ROLLED BACK at
-- the end so the database is left untouched.
--
-- Run manually against a linked DB:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hittrax_pr_trigger.test.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_tenant_id    uuid := '00000000-0000-0000-0000-000000000001';  -- Infinite Hitting
  v_family_id    uuid;
  v_kid_id       uuid;
  v_user_id      uuid;
  v_swing1_id    uuid;
  v_swing2_id    uuid;
  v_swing3_id    uuid;
  v_pb_value     numeric;
  v_balance_before int;
  v_balance_after  int;
  v_ledger_count int;
  v_is_pb        boolean;
BEGIN
  -- Fixture parent + family + kid. We use a real auth.users row so the
  -- families.parent_user_id FK is satisfied, then ROLLBACK the whole thing.
  v_user_id := gen_random_uuid();
  INSERT INTO auth.users (id, email, instance_id)
       VALUES (v_user_id, format('hittrax-test-%s@ballpark.test', v_user_id), '00000000-0000-0000-0000-000000000000');

  INSERT INTO public.families (tenant_id, parent_user_id, parent_first_name, parent_last_name, parent_email)
       VALUES (v_tenant_id, v_user_id, 'Test', 'Parent', format('hittrax-test-%s@ballpark.test', v_user_id))
       RETURNING id INTO v_family_id;

  INSERT INTO public.kids (tenant_id, family_id, first_name, last_name, points_balance)
       VALUES (v_tenant_id, v_family_id, 'Test', 'Kid', 0)
       RETURNING id, points_balance INTO v_kid_id, v_balance_before;

  -- ---------------------------------------------------------------------
  -- 1. First swing: 88.5 mph EV, 320 ft, 70 mph pitch — all three are PRs
  --    by definition (no prior PB row).
  -- ---------------------------------------------------------------------
  v_swing1_id := gen_random_uuid();
  INSERT INTO public.swings (
    id, tenant_id, kid_id, capture_source, capture_event_id, occurred_at,
    exit_velocity_mph, distance_ft, pitch_speed_mph
  ) VALUES (
    v_swing1_id, v_tenant_id, v_kid_id, 'hittrax', format('event-%s-1', v_kid_id), now(),
    88.5, 320, 70.0
  );

  SELECT is_personal_best INTO v_is_pb FROM public.swings WHERE id = v_swing1_id;
  IF NOT v_is_pb THEN
    RAISE EXCEPTION 'expected swing1 is_personal_best=true (first swing always PR)';
  END IF;

  SELECT value INTO v_pb_value FROM public.personal_bests WHERE kid_id = v_kid_id AND metric = 'exit_velocity_mph';
  IF v_pb_value IS DISTINCT FROM 88.5 THEN
    RAISE EXCEPTION 'expected EV PB=88.5, got %', v_pb_value;
  END IF;

  SELECT count(*) INTO v_ledger_count FROM public.points_ledger
   WHERE kid_id = v_kid_id AND reason = 'pr_hit' AND reference_type = 'swing' AND reference_id = v_swing1_id;
  IF v_ledger_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 pr_hit ledger row for swing1, got %', v_ledger_count;
  END IF;

  SELECT points_balance INTO v_balance_after FROM public.kids WHERE id = v_kid_id;
  IF v_balance_after - v_balance_before <> 15 THEN
    RAISE EXCEPTION 'expected +15 balance after swing1, got %', v_balance_after - v_balance_before;
  END IF;

  -- ---------------------------------------------------------------------
  -- 2. Second swing: 87.0 mph EV (NOT a PR), 350 ft (PR), 65 mph (NOT).
  --    Should still award +15 because at least one metric beat its PR.
  -- ---------------------------------------------------------------------
  v_balance_before := v_balance_after;
  v_swing2_id := gen_random_uuid();
  INSERT INTO public.swings (
    id, tenant_id, kid_id, capture_source, capture_event_id, occurred_at,
    exit_velocity_mph, distance_ft, pitch_speed_mph
  ) VALUES (
    v_swing2_id, v_tenant_id, v_kid_id, 'hittrax', format('event-%s-2', v_kid_id), now(),
    87.0, 350, 65.0
  );

  SELECT value INTO v_pb_value FROM public.personal_bests WHERE kid_id = v_kid_id AND metric = 'exit_velocity_mph';
  IF v_pb_value IS DISTINCT FROM 88.5 THEN
    RAISE EXCEPTION 'EV PB should still be 88.5 (swing2 EV=87 is lower), got %', v_pb_value;
  END IF;
  SELECT value INTO v_pb_value FROM public.personal_bests WHERE kid_id = v_kid_id AND metric = 'distance_ft';
  IF v_pb_value IS DISTINCT FROM 350 THEN
    RAISE EXCEPTION 'distance PB should be 350, got %', v_pb_value;
  END IF;

  SELECT points_balance INTO v_balance_after FROM public.kids WHERE id = v_kid_id;
  IF v_balance_after - v_balance_before <> 15 THEN
    RAISE EXCEPTION 'expected +15 balance after swing2 (distance PR), got %', v_balance_after - v_balance_before;
  END IF;

  -- ---------------------------------------------------------------------
  -- 3. Third swing: 80 mph EV, 200 ft, 60 mph — NO PRs.
  --    is_personal_best=false; ledger unchanged; balance unchanged.
  -- ---------------------------------------------------------------------
  v_balance_before := v_balance_after;
  v_swing3_id := gen_random_uuid();
  INSERT INTO public.swings (
    id, tenant_id, kid_id, capture_source, capture_event_id, occurred_at,
    exit_velocity_mph, distance_ft, pitch_speed_mph
  ) VALUES (
    v_swing3_id, v_tenant_id, v_kid_id, 'hittrax', format('event-%s-3', v_kid_id), now(),
    80, 200, 60
  );

  SELECT is_personal_best INTO v_is_pb FROM public.swings WHERE id = v_swing3_id;
  IF v_is_pb THEN
    RAISE EXCEPTION 'expected swing3 is_personal_best=false (no metric beat its PR)';
  END IF;

  SELECT count(*) INTO v_ledger_count FROM public.points_ledger
   WHERE kid_id = v_kid_id AND reason = 'pr_hit' AND reference_type = 'swing' AND reference_id = v_swing3_id;
  IF v_ledger_count <> 0 THEN
    RAISE EXCEPTION 'expected 0 pr_hit ledger rows for swing3, got %', v_ledger_count;
  END IF;

  SELECT points_balance INTO v_balance_after FROM public.kids WHERE id = v_kid_id;
  IF v_balance_after <> v_balance_before THEN
    RAISE EXCEPTION 'expected balance unchanged after swing3, delta=%', v_balance_after - v_balance_before;
  END IF;

  -- ---------------------------------------------------------------------
  -- 4. Idempotency: re-insert swing1 by (capture_source, capture_event_id).
  --    The swings UNIQUE rejects the row before the trigger fires.
  -- ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.swings (
      tenant_id, kid_id, capture_source, capture_event_id, occurred_at,
      exit_velocity_mph
    ) VALUES (
      v_tenant_id, v_kid_id, 'hittrax', format('event-%s-1', v_kid_id), now(), 99.0
    );
    RAISE EXCEPTION 'expected unique_violation on duplicate (capture_source, capture_event_id), got success';
  EXCEPTION WHEN unique_violation THEN
    -- expected
    NULL;
  END;

  SELECT value INTO v_pb_value FROM public.personal_bests WHERE kid_id = v_kid_id AND metric = 'exit_velocity_mph';
  IF v_pb_value IS DISTINCT FROM 88.5 THEN
    RAISE EXCEPTION 'EV PB should still be 88.5 after rejected duplicate, got %', v_pb_value;
  END IF;

  -- ---------------------------------------------------------------------
  -- 5. Idempotency #2: even if the trigger fires twice for the same swing,
  --    the partial unique on points_ledger.reference_id absorbs the dup.
  --    We simulate by manually re-running the trigger function via a
  --    second INSERT into points_ledger with the same reference_id.
  -- ---------------------------------------------------------------------
  v_balance_before := (SELECT points_balance FROM public.kids WHERE id = v_kid_id);
  BEGIN
    INSERT INTO public.points_ledger (
      tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
    ) VALUES (
      v_tenant_id, v_kid_id, 15, 'pr_hit', 'swing', v_swing1_id, v_balance_before + 15, 'duplicate'
    );
    RAISE EXCEPTION 'expected unique_violation on duplicate pr_hit ledger row, got success';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RAISE NOTICE 'PASS: detect_swing_pr trigger correctness + idempotency invariants hold';
END
$$;

ROLLBACK;
