-- =============================================================================
-- Ballpark — invariant test: videos.mux_asset_id is NOT NULL + UNIQUE
-- =============================================================================
-- The mux-webhook Edge Function runs as service role (bypasses RLS) and keys
-- every UPDATE on the UNIQUE videos.mux_asset_id column. That uniqueness is
-- the ONLY thing standing between a forged Mux event and a cross-tenant
-- write. If a future migration drops NOT NULL or relaxes UNIQUE on
-- videos.mux_asset_id without an explicit replacement, this test must fail.
--
-- Run manually against a linked DB:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/videos_mux_asset_id_constraint.test.sql
--
-- The same invariant is enforced statically against the migrations directory
-- by scripts/check-mux-asset-id-constraint.mjs, which runs in
-- scripts/post-merge.sh after every merge.
-- =============================================================================

DO $$
DECLARE
  v_is_nullable text;
  v_unique_count int;
BEGIN
  SELECT is_nullable
    INTO v_is_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'videos'
     AND column_name  = 'mux_asset_id';

  IF v_is_nullable IS NULL THEN
    RAISE EXCEPTION 'videos.mux_asset_id column is missing';
  END IF;

  IF v_is_nullable <> 'NO' THEN
    RAISE EXCEPTION 'videos.mux_asset_id must be NOT NULL (got is_nullable=%)', v_is_nullable;
  END IF;

  -- A UNIQUE or PRIMARY KEY constraint on (mux_asset_id) alone satisfies
  -- the invariant. We count any single-column unique-or-pkey constraint on
  -- public.videos that targets exactly mux_asset_id.
  SELECT count(*)
    INTO v_unique_count
    FROM pg_constraint c
    JOIN pg_class      t ON t.oid = c.conrelid
    JOIN pg_namespace  n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND t.relname = 'videos'
     AND c.contype IN ('u', 'p')
     AND c.conkey = ARRAY[
       (SELECT attnum FROM pg_attribute
         WHERE attrelid = t.oid AND attname = 'mux_asset_id')
     ]::int2[];

  IF v_unique_count < 1 THEN
    RAISE EXCEPTION 'videos.mux_asset_id must have a single-column UNIQUE (or PK) constraint';
  END IF;

  RAISE NOTICE 'PASS: videos.mux_asset_id is NOT NULL and UNIQUE (% matching constraint(s))', v_unique_count;
END
$$;
