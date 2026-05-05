-- =============================================================================
-- Ballpark — v0.3 Step 3.11: Default families.primary_location_id
-- =============================================================================
-- Two related changes in one migration so they land atomically:
--
-- 1. Trigger: handle_new_user now resolves the tenant's first location
--    (alphabetical by name) and inserts it as the new family's
--    primary_location_id. Stays NULL when the tenant has zero locations
--    (graceful — no error, downstream UI treats it as "no home location yet").
--
-- 2. Backfill: existing families with NULL primary_location_id get the same
--    default (per-row tenant lookup). Idempotent: only touches NULL rows.
--
-- Why: every existing dev family has primary_location_id = NULL, which
-- silently breaks the Book tab Date picker (usePrimaryLocation's TanStack
-- query stays disabled and pinned isPending=true forever). Defaulting at
-- signup time prevents the entire class of bug.
--
-- The CREATE OR REPLACE preserves the function OID; the EXECUTE revokes
-- from 20260505015720_revoke_handle_new_user_execute.sql therefore remain
-- in effect — but we re-revoke at the bottom defensively in case any
-- downstream rebuild re-grants them.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_slug         text;
  v_tenant_id           uuid;
  v_primary_location_id uuid;
BEGIN
  v_tenant_slug := NEW.raw_user_meta_data->>'tenant_slug';

  IF v_tenant_slug IS NULL OR v_tenant_slug = '' THEN
    RAISE EXCEPTION 'handle_new_user: tenant_slug missing from raw_user_meta_data';
  END IF;

  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_tenant_slug;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: unknown tenant_slug %', v_tenant_slug;
  END IF;

  -- Default the family's home location to the tenant's first location
  -- (alphabetical). NULL is fine if the tenant has no locations yet.
  SELECT id
    INTO v_primary_location_id
    FROM public.locations
   WHERE tenant_id = v_tenant_id
   ORDER BY name ASC
   LIMIT 1;

  INSERT INTO public.families (
    tenant_id,
    parent_user_id,
    parent_first_name,
    parent_last_name,
    parent_phone,
    parent_email,
    primary_location_id
  ) VALUES (
    v_tenant_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.email,
    v_primary_location_id
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Re-assert the hardened EXECUTE grants from
-- 20260505015720_revoke_handle_new_user_execute.sql. CREATE OR REPLACE
-- preserves grants in PostgreSQL, so this is defensive only.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;


-- -----------------------------------------------------------------------------
-- Backfill existing families with NULL primary_location_id
-- -----------------------------------------------------------------------------
-- Per-row lookup of the tenant's first location (alphabetical). Families
-- whose tenant has zero locations stay NULL — same graceful behaviour as
-- the trigger.
UPDATE public.families AS f
   SET primary_location_id = sub.id
  FROM (
    SELECT DISTINCT ON (l.tenant_id) l.tenant_id, l.id
      FROM public.locations l
     ORDER BY l.tenant_id, l.name ASC
  ) AS sub
 WHERE f.primary_location_id IS NULL
   AND f.tenant_id = sub.tenant_id;
