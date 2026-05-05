-- =============================================================================
-- Ballpark — v0.3 Step 3.1: Bookings + sessions schema
-- =============================================================================
-- Adds the three foundation tables for the v0.3 Booking System:
--   - session_types         (tenant-scoped catalogue: Private / Group / Cage)
--   - coach_availability    (recurring weekly slots per coach)
--   - bookings              (actual booked sessions)
--
-- Conventions (carried over from v0.1):
--   - Tenant pin on every write policy (USING + WITH CHECK both reference
--     tenant_id = JWT tenant_id) so a parent cannot smuggle a row into
--     another tenant.
--   - App-level role checks read auth.jwt() ->> 'app_role' (NOT 'role',
--     which is reserved by PostgREST for Postgres SET ROLE).
--   - Per-table GRANTs match RLS scope. RLS narrows rows; GRANTs gate the
--     verb.
--   - Reuses public.set_updated_at() created in the v0.1 initial migration.
--
-- Order: tables (FK order) -> indexes -> updated_at triggers ->
--        RLS enable -> RLS policies -> GRANTs.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- session_types ---------------------------------------------------------------
-- Catalogue of bookable session offerings. Tenant-scoped so each franchise can
-- maintain its own pricing and lineup.
CREATE TABLE public.session_types (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  type_category      text        NOT NULL CHECK (type_category IN ('private', 'group', 'cage')),
  duration_minutes   int         NOT NULL CHECK (duration_minutes > 0),
  base_price_cents   int         NOT NULL DEFAULT 0 CHECK (base_price_cents >= 0),
  description        text,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- coach_availability ----------------------------------------------------------
-- Recurring weekly windows when a coach is bookable at a given location.
-- Append-only for now (no updated_at) — v0.3 Phase B will edit these via
-- delete + re-insert when the coach portal lands.
CREATE TABLE public.coach_availability (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  coach_id           uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  location_id        uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  day_of_week        int         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time         time        NOT NULL,
  end_time           time        NOT NULL,
  is_recurring       boolean     NOT NULL DEFAULT true,
  effective_from     date,
  effective_until    date,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_availability_time_order CHECK (end_time > start_time),
  CONSTRAINT coach_availability_date_order CHECK (
    effective_until IS NULL
    OR effective_from IS NULL
    OR effective_until >= effective_from
  )
);

-- bookings --------------------------------------------------------------------
-- Actual booked sessions. status flow: pending -> confirmed ->
-- completed | cancelled | no_show. tenant_id is pinned for fast RLS and
-- to keep cross-tenant joins impossible.
CREATE TABLE public.bookings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id         uuid        NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  kid_id              uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  coach_id            uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  session_type_id     uuid        NOT NULL REFERENCES public.session_types(id) ON DELETE RESTRICT,
  scheduled_start     timestamptz NOT NULL,
  scheduled_end       timestamptz NOT NULL,
  cage_number         text,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  attended_at         timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_time_order CHECK (scheduled_end > scheduled_start)
);


-- -----------------------------------------------------------------------------
-- 2. Indexes on every FK column (and a few hot lookup keys)
-- -----------------------------------------------------------------------------
CREATE INDEX idx_session_types_tenant_id              ON public.session_types(tenant_id);

CREATE INDEX idx_coach_availability_tenant_id         ON public.coach_availability(tenant_id);
CREATE INDEX idx_coach_availability_coach_id          ON public.coach_availability(coach_id);
CREATE INDEX idx_coach_availability_location_id       ON public.coach_availability(location_id);

CREATE INDEX idx_bookings_tenant_id                   ON public.bookings(tenant_id);
CREATE INDEX idx_bookings_location_id                 ON public.bookings(location_id);
CREATE INDEX idx_bookings_kid_id                      ON public.bookings(kid_id);
CREATE INDEX idx_bookings_coach_id                    ON public.bookings(coach_id);
CREATE INDEX idx_bookings_session_type_id             ON public.bookings(session_type_id);
CREATE INDEX idx_bookings_scheduled_start             ON public.bookings(scheduled_start);


-- -----------------------------------------------------------------------------
-- 3. updated_at triggers (session_types + bookings only;
--    coach_availability is append-only for now)
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_session_types_updated_at BEFORE UPDATE ON public.session_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bookings_updated_at      BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. RLS: enable on all 3 tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.session_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings            ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 5. RLS policies
-- -----------------------------------------------------------------------------

-- session_types: SELECT within own tenant. No client writes for v0.3 Phase A;
-- catalogue is provisioned via seed / coach portal later.
CREATE POLICY session_types_select_tenant ON public.session_types
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- coach_availability: SELECT within own tenant. tenant_id is denormalized on
-- the row for fast RLS (avoids a join to coaches on every read).
CREATE POLICY coach_availability_select_tenant ON public.coach_availability
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- bookings: parent has full CRUD over bookings whose kid belongs to their
-- family AND whose tenant matches the JWT tenant. Coach has SELECT for
-- bookings assigned to them.

CREATE POLICY bookings_select_own_family ON public.bookings
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
  );

CREATE POLICY bookings_insert_own_family ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
  );

CREATE POLICY bookings_update_own_family ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
  );

CREATE POLICY bookings_delete_own_family ON public.bookings
  FOR DELETE TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
    )
  );

CREATE POLICY bookings_select_coach ON public.bookings
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND coach_id IN (
      SELECT id FROM public.coaches WHERE user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 6. GRANTs (RLS narrows rows; GRANTs gate the verb).
--    Privilege model:
--      session_types       authenticated: SELECT
--      coach_availability  authenticated: SELECT
--      bookings            authenticated: SELECT, INSERT, UPDATE, DELETE
-- -----------------------------------------------------------------------------
GRANT SELECT                          ON public.session_types      TO authenticated;
GRANT SELECT                          ON public.coach_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.bookings           TO authenticated;
