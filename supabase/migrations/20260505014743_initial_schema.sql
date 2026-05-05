-- =============================================================================
-- Ballpark — Initial schema migration (v0.1 Step 1.5 Part B)
-- =============================================================================
-- Creates the 5 foundation tables (tenants, locations, families, kids, coaches),
-- their indexes, updated_at triggers, RLS policies, the auth.users INSERT
-- trigger that provisions a family on signup, and the Custom Access Token Hook
-- that injects tenant_id / family_id / role into every JWT.
--
-- Order matters: helper fn -> tables (in FK order) -> indexes -> updated_at
-- triggers -> auth functions -> RLS enable -> RLS policies -> seed.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Helper: set_updated_at trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. Tables (in dependency order)
-- -----------------------------------------------------------------------------

-- tenants ----------------------------------------------------------------------
CREATE TABLE public.tenants (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  slug               text        NOT NULL UNIQUE,
  brand_colors       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  brand_logo_url     text,
  stripe_account_id  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- locations --------------------------------------------------------------------
CREATE TABLE public.locations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  address            text,
  city               text,
  state              text,
  zip                text,
  phone              text,
  email              text,
  timezone           text        NOT NULL DEFAULT 'America/Chicago',
  stripe_account_id  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- families ---------------------------------------------------------------------
-- NOTE: `role` column is hard-coded to 'parent' for v0.1. The custom access
-- token hook reads from this column to set the JWT `role` claim. When we add
-- additional family-side roles (e.g. 'co_parent', 'guardian') in v0.6+, expand
-- the CHECK constraint and update the hook accordingly.
CREATE TABLE public.families (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  primary_location_id  uuid        REFERENCES public.locations(id) ON DELETE SET NULL,
  parent_user_id       uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_first_name    text        NOT NULL,
  parent_last_name     text        NOT NULL,
  parent_phone         text,
  parent_email         text        NOT NULL,
  stripe_customer_id   text,
  role                 text        NOT NULL DEFAULT 'parent' CHECK (role IN ('parent')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- kids -------------------------------------------------------------------------
CREATE TABLE public.kids (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id            uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  first_name           text        NOT NULL,
  last_name            text        NOT NULL,
  date_of_birth        date,
  age_group            text        CHECK (age_group IN ('9U','10U','11U','12U','13U','14U','15U+')),
  primary_position     text,
  jersey_number        int,
  avatar_url           text,
  points_balance       int         NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  current_streak_days  int         NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- coaches ----------------------------------------------------------------------
CREATE TABLE public.coaches (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  primary_location_id  uuid        REFERENCES public.locations(id) ON DELETE SET NULL,
  user_id              uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name           text        NOT NULL,
  last_name            text        NOT NULL,
  specialty            text,
  bio                  text,
  avatar_url           text,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 3. Indexes on every FK column
-- -----------------------------------------------------------------------------
CREATE INDEX idx_locations_tenant_id              ON public.locations(tenant_id);
CREATE INDEX idx_families_tenant_id               ON public.families(tenant_id);
CREATE INDEX idx_families_primary_location_id     ON public.families(primary_location_id);
CREATE INDEX idx_kids_family_id                   ON public.kids(family_id);
CREATE INDEX idx_coaches_tenant_id                ON public.coaches(tenant_id);
CREATE INDEX idx_coaches_primary_location_id      ON public.coaches(primary_location_id);


-- -----------------------------------------------------------------------------
-- 4. updated_at triggers on all 5 tables
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_tenants_updated_at   BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_families_updated_at  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kids_updated_at      BEFORE UPDATE ON public.kids
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_coaches_updated_at   BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. Auth: handle_new_user trigger on auth.users
-- -----------------------------------------------------------------------------
-- IMPORTANT (v0.1 only): tenant resolution from raw_user_meta_data->>'tenant_slug'
-- is a per-build temporary mechanism. Each franchise build bakes
-- EXPO_PUBLIC_TENANT_SLUG into the bundle and the client passes it in signup
-- metadata. v1.x will switch to runtime tenant detection (subdomain / magic
-- link / invite token); update this function then.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_slug text;
  v_tenant_id   uuid;
BEGIN
  v_tenant_slug := NEW.raw_user_meta_data->>'tenant_slug';

  IF v_tenant_slug IS NULL OR v_tenant_slug = '' THEN
    RAISE EXCEPTION 'handle_new_user: tenant_slug missing from raw_user_meta_data';
  END IF;

  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_tenant_slug;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: unknown tenant_slug %', v_tenant_slug;
  END IF;

  INSERT INTO public.families (
    tenant_id,
    parent_user_id,
    parent_first_name,
    parent_last_name,
    parent_phone,
    parent_email
  ) VALUES (
    v_tenant_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.email
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 6. Auth: custom_access_token_hook
-- -----------------------------------------------------------------------------
-- Injects tenant_id, family_id, role into every issued JWT.
-- Looks up the user as a parent (families) first; falls back to coaches.
-- Registered via supabase/config.toml [auth.hook.custom_access_token].
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_claims    jsonb;
  v_tenant_id uuid;
  v_family_id uuid;
  v_role      text;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := event->'claims';

  -- Try parent / family first.
  SELECT tenant_id, id, role
    INTO v_tenant_id, v_family_id, v_role
    FROM public.families
   WHERE parent_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object(
           'tenant_id', v_tenant_id,
           'family_id', v_family_id,
           'role',      v_role
         );
  ELSE
    -- Fallback: coach.
    SELECT tenant_id INTO v_tenant_id
      FROM public.coaches
     WHERE user_id = v_user_id AND is_active = true;

    IF v_tenant_id IS NOT NULL THEN
      v_claims := v_claims
        || jsonb_build_object(
             'tenant_id', v_tenant_id,
             'role',      'coach'
           );
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;


-- -----------------------------------------------------------------------------
-- 7. RLS: enable on all 5 tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kids      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches   ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 8. RLS policies
-- -----------------------------------------------------------------------------

-- tenants: SELECT own tenant only; no client INSERT/UPDATE/DELETE.
CREATE POLICY tenants_select_own ON public.tenants
  FOR SELECT TO authenticated
  USING (id = (auth.jwt() ->> 'tenant_id')::uuid);

-- locations: SELECT all locations within own tenant.
CREATE POLICY locations_select_tenant ON public.locations
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- families: parent SELECTs / UPDATEs own family; coach can SELECT families
-- in their tenant (stub — tighten when coach UI lands).
CREATE POLICY families_select_own ON public.families
  FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid());

CREATE POLICY families_update_own ON public.families
  FOR UPDATE TO authenticated
  USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

CREATE POLICY families_select_coach_stub ON public.families
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'role') = 'coach'
  );

-- kids: parent has full CRUD over kids in their family; coach SELECT stub.
CREATE POLICY kids_select_own_family ON public.kids
  FOR SELECT TO authenticated
  USING (
    family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
  );

CREATE POLICY kids_insert_own_family ON public.kids
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
  );

CREATE POLICY kids_update_own_family ON public.kids
  FOR UPDATE TO authenticated
  USING (
    family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
  )
  WITH CHECK (
    family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
  );

CREATE POLICY kids_delete_own_family ON public.kids
  FOR DELETE TO authenticated
  USING (
    family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
  );

CREATE POLICY kids_select_coach_stub ON public.kids
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'coach'
    AND family_id IN (
      SELECT id FROM public.families
       WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- coaches: SELECT active coaches in own tenant; coach can UPDATE own row.
CREATE POLICY coaches_select_active_in_tenant ON public.coaches
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND is_active = true
  );

CREATE POLICY coaches_update_own ON public.coaches
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 9. Seed: anchor tenant + one starter location
-- -----------------------------------------------------------------------------
INSERT INTO public.tenants (id, name, slug, brand_colors)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Infinite Hitting',
  'infinitehitting',
  jsonb_build_object(
    'dark',   '#2D2B2A',
    'darker', '#1C1B1A',
    'gold',   '#F1E5AD',
    'goldDeep','#B8A268',
    'cream',  '#FAF6E8'
  )
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.locations (id, tenant_id, name, city, state, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Dallas N.',
  'Dallas',
  'TX',
  'America/Chicago'
)
ON CONFLICT (id) DO NOTHING;
