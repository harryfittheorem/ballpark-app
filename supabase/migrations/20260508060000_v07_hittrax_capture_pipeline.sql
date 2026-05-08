-- =============================================================================
-- Ballpark — task #118: HitTrax capture pipeline schema
-- =============================================================================
-- Adds the four foundation tables for swing-data ingest:
--
--   public.sessions             one cage session = a contiguous batch of swings
--   public.swings               one swing recorded by a capture system
--   public.personal_bests       canonical PR per (kid, metric)
--   public.kid_capture_links    one link per (kid, capture_source) — tracks
--                               the HitTrax association lifecycle and the
--                               per-link polling cursor
--
-- Plus a trigger that detects PRs on swing insert, writes/updates
-- personal_bests, sets swings.is_personal_best, and inserts a
-- points_ledger row (+15, reason='pr_hit', reference_type='swing').
--
-- Conventions carried from v0.1–v0.6:
--   * Tenant pin on every write/select policy via JWT tenant_id claim.
--   * App-level role checks read auth.jwt() ->> 'app_role' (NOT 'role').
--   * Per-table GRANTs match RLS scope. RLS narrows rows; GRANTs gate the verb.
--   * Reuses public.set_updated_at().
--   * SECURITY DEFINER functions ALTER OWNER TO postgres so they bypass RLS
--     on the rows they mutate; ownership/tenant pinning is re-asserted in
--     plpgsql before any write.
--
-- Idempotency is the entire architectural backbone: every swing carries a
-- UNIQUE (capture_source, capture_event_id), every session a
-- UNIQUE (capture_source, capture_session_id), and the PR ledger insert
-- is guarded by a partial unique index on (reference_id) where
-- reason='pr_hit' AND reference_type='swing'. Replays are no-ops by
-- construction — the polling worker never has to remember what it sent.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- sessions ---------------------------------------------------------------------
-- A "session" is a contiguous batch of swings. For HitTrax this comes from the
-- terminal grouping; for manual entry it can be a coach-tagged block. We store
-- per-session aggregates so the Sessions list (task #119) can render without
-- re-aggregating swings on every read.
CREATE TABLE public.sessions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id                   uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  capture_source           text        NOT NULL CHECK (capture_source IN ('hittrax', 'rapsodo', 'manual', 'none')),
  -- HitTrax (or future capture) session identifier. NULL for manual sessions.
  capture_session_id       text,
  -- HitTrax FacilityID (or equivalent). Stored for ops debugging + future
  -- "which cage location did this happen at" filtering.
  facility_id              text,
  started_at               timestamptz NOT NULL,
  ended_at                 timestamptz,
  swing_count              int         NOT NULL DEFAULT 0 CHECK (swing_count >= 0),
  best_exit_velocity_mph   numeric(5,1),
  avg_exit_velocity_mph    numeric(5,1),
  max_distance_ft          int,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_time_order CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- (capture_source, capture_session_id) is the idempotency key for sessions.
-- Partial unique because manual sessions don't carry a capture_session_id.
CREATE UNIQUE INDEX uniq_sessions_capture
  ON public.sessions (capture_source, capture_session_id)
  WHERE capture_session_id IS NOT NULL;

-- swings -----------------------------------------------------------------------
-- One row per recorded swing. capture_event_id is the HitTrax-provided unique
-- swing identifier (or future-system equivalent). The composite UNIQUE makes
-- replays idempotent — re-polling the same window UPSERTs with no duplicates.
CREATE TABLE public.swings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id              uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  session_id          uuid        REFERENCES public.sessions(id) ON DELETE SET NULL,
  capture_source      text        NOT NULL CHECK (capture_source IN ('hittrax', 'rapsodo', 'manual')),
  -- HitTrax-provided swing/event id (or future-system equivalent).
  capture_event_id    text        NOT NULL,
  occurred_at         timestamptz NOT NULL,
  -- Headline metrics. All nullable because not every system reports every
  -- field, and HitTrax content-types vary by contract tier.
  exit_velocity_mph   numeric(5,1) CHECK (exit_velocity_mph IS NULL OR exit_velocity_mph >= 0),
  launch_angle_deg    numeric(5,1),
  distance_ft         int          CHECK (distance_ft IS NULL OR distance_ft >= 0),
  contact_quality     text,
  result              text,
  pitch_speed_mph     numeric(5,1) CHECK (pitch_speed_mph IS NULL OR pitch_speed_mph >= 0),
  spray_angle_deg     numeric(5,1),
  -- TRUE iff the PR trigger detected at least one new personal best on insert.
  is_personal_best    boolean      NOT NULL DEFAULT false,
  -- Raw HitTrax payload for the swing — kept verbatim for debugging /
  -- replay / future re-parsing without another HitTrax round-trip.
  raw                 jsonb,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT swings_capture_event_id_present CHECK (length(capture_event_id) > 0),
  CONSTRAINT swings_capture_event_unique UNIQUE (capture_source, capture_event_id)
);

-- personal_bests ---------------------------------------------------------------
-- One row per (kid_id, metric). Updated in place by the PR trigger.
CREATE TABLE public.personal_bests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id       uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  metric       text        NOT NULL CHECK (metric IN (
                              'exit_velocity_mph',
                              'distance_ft',
                              'launch_angle_deg',
                              'pitch_speed_mph'
                            )),
  value        numeric     NOT NULL,
  swing_id     uuid        REFERENCES public.swings(id) ON DELETE SET NULL,
  achieved_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_bests_kid_metric_unique UNIQUE (kid_id, metric)
);

-- kid_capture_links ------------------------------------------------------------
-- Tracks the HitTrax association lifecycle for a single (kid, capture_source).
-- third_party_user_id is the opaque UUID we send to HitTrax as ThirdPartyUserID
-- — we never store the parent's HitTrax email or password, only the
-- HitTrax-issued password returned in CompleteHitTraxRegistration.
--
-- The polling cursor (last_polled_through) is a timestamp because HitTrax's
-- GetAvailableThirdPartyData uses StartDate/EndDate, not an opaque token.
-- We advance it ONLY after a successful poll + UPSERT of all returned swings.
CREATE TABLE public.kid_capture_links (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id                        uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  capture_source                text        NOT NULL CHECK (capture_source IN ('hittrax', 'rapsodo')),
  -- Our internal UUID we send to HitTrax as ThirdPartyUserID. Never reused.
  third_party_user_id           text        NOT NULL,
  -- The HitTrax UserID the parent typed. Stored only for ops debugging /
  -- support — we do NOT use it for any HitTrax API call after associate.
  external_user_id              text,
  -- HitTrax-issued password returned in CompleteHitTraxRegistration. Used as
  -- the auth on every subsequent GetAvailableThirdPartyData / Remove / Forget
  -- call. Treat as a credential — never log, never return to the client.
  third_party_user_password     text,
  -- The two booleans HitTrax returns from AssociateThirdPartyAccount. Stored
  -- for support / "your HitTrax subscription needs upgrading" UX.
  hittrax_registration_status   boolean,
  hittrax_release_status        boolean,
  association_status            text        NOT NULL DEFAULT 'pending'
                                  CHECK (association_status IN ('pending', 'active', 'declined', 'removed')),
  associated_at                 timestamptz,
  removed_at                    timestamptz,
  -- Polling cursor. Only swings with occurred_at > last_polled_through are
  -- considered new. Initialised to associated_at when the link first goes
  -- active, advanced by hittrax-poll on success.
  last_polled_through           timestamptz,
  last_polled_at                timestamptz,
  last_poll_error               text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kid_capture_links_third_party_user_id_unique
    UNIQUE (capture_source, third_party_user_id),
  -- One link per (kid, capture_source). 'removed' links are kept for audit
  -- but a kid can only have one ACTIVE/PENDING/DECLINED link per source —
  -- enforced by a partial unique index (so 'removed' rows don't block re-link).
  CONSTRAINT kid_capture_links_kid_source_unique
    UNIQUE (kid_id, capture_source)
);


-- -----------------------------------------------------------------------------
-- 2. Indexes on FK columns + hot lookup keys
-- -----------------------------------------------------------------------------
CREATE INDEX idx_sessions_tenant_id            ON public.sessions(tenant_id);
CREATE INDEX idx_sessions_kid_id_started_at    ON public.sessions(kid_id, started_at DESC);

CREATE INDEX idx_swings_tenant_id              ON public.swings(tenant_id);
CREATE INDEX idx_swings_kid_id_occurred_at     ON public.swings(kid_id, occurred_at DESC);
CREATE INDEX idx_swings_session_id             ON public.swings(session_id);

CREATE INDEX idx_personal_bests_tenant_id      ON public.personal_bests(tenant_id);
CREATE INDEX idx_personal_bests_kid_id         ON public.personal_bests(kid_id);

CREATE INDEX idx_kid_capture_links_tenant_id   ON public.kid_capture_links(tenant_id);
CREATE INDEX idx_kid_capture_links_kid_id      ON public.kid_capture_links(kid_id);
-- Hot path for the polling worker: find every active link, oldest cursor first.
CREATE INDEX idx_kid_capture_links_poll_cursor
  ON public.kid_capture_links(association_status, last_polled_at NULLS FIRST)
  WHERE association_status = 'active';


-- -----------------------------------------------------------------------------
-- 3. updated_at triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_sessions_updated_at          BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_personal_bests_updated_at    BEFORE UPDATE ON public.personal_bests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kid_capture_links_updated_at BEFORE UPDATE ON public.kid_capture_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. PR detection trigger on swings
-- -----------------------------------------------------------------------------
-- Runs AFTER INSERT on public.swings. For each metric the new swing carries,
-- compares to the existing personal_bests row (if any) and if higher (or
-- absent) UPSERTs the PR row. If at least one PR was set, flips
-- swings.is_personal_best=true and inserts a +15 points_ledger row keyed
-- on the swing.
--
-- Idempotency:
--   * Re-inserting the same swing is impossible due to the UNIQUE on
--     (capture_source, capture_event_id) — the second insert errors out
--     before the trigger fires.
--   * The points_ledger insert is guarded by a partial unique index on
--     reference_id WHERE reason='pr_hit' AND reference_type='swing', so
--     even if the trigger were re-fired for the same swing.id (which it
--     can't be in normal operation), the duplicate ledger row would be
--     rejected and the trigger would gracefully no-op.
--
-- Defense-in-depth: SET search_path is pinned, OWNER is postgres so the
-- function bypasses RLS on points_ledger / personal_bests (both of which
-- have no client write policy). tenant_id and kid_id are read from the
-- NEW row — never from caller input — so cross-tenant smuggling is
-- impossible.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_swing_pr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_award constant int := 15;
  v_metric text;
  v_value  numeric;
  v_existing_value numeric;
  v_any_pr boolean := false;
  v_new_balance int;
  -- Iterate over the metrics we recognise as PR-eligible. launch_angle is
  -- intentionally excluded — "highest launch angle" isn't a meaningful PR.
  v_metrics text[] := ARRAY['exit_velocity_mph', 'distance_ft', 'pitch_speed_mph'];
BEGIN
  FOREACH v_metric IN ARRAY v_metrics LOOP
    v_value := CASE v_metric
      WHEN 'exit_velocity_mph' THEN NEW.exit_velocity_mph
      WHEN 'distance_ft'       THEN NEW.distance_ft::numeric
      WHEN 'pitch_speed_mph'   THEN NEW.pitch_speed_mph
    END;

    IF v_value IS NULL THEN CONTINUE; END IF;

    SELECT value INTO v_existing_value
      FROM public.personal_bests
     WHERE kid_id = NEW.kid_id AND metric = v_metric
     FOR UPDATE;

    IF NOT FOUND THEN
      -- First time we've seen this metric for this kid — it IS a PR by definition.
      INSERT INTO public.personal_bests (tenant_id, kid_id, metric, value, swing_id, achieved_at)
      VALUES (NEW.tenant_id, NEW.kid_id, v_metric, v_value, NEW.id, NEW.occurred_at);
      v_any_pr := true;
    ELSIF v_value > v_existing_value THEN
      UPDATE public.personal_bests
         SET value = v_value,
             swing_id = NEW.id,
             achieved_at = NEW.occurred_at
       WHERE kid_id = NEW.kid_id AND metric = v_metric;
      v_any_pr := true;
    END IF;
  END LOOP;

  IF v_any_pr THEN
    -- Mark the swing for the UI badge.
    UPDATE public.swings SET is_personal_best = true WHERE id = NEW.id;

    -- Award points + write ledger row. Guard with the partial unique index;
    -- a duplicate insert (e.g. trigger re-firing) becomes a graceful no-op.
    BEGIN
      UPDATE public.kids
         SET points_balance = points_balance + v_award
       WHERE id = NEW.kid_id
       RETURNING points_balance INTO v_new_balance;

      INSERT INTO public.points_ledger (
        tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
      ) VALUES (
        NEW.tenant_id, NEW.kid_id, v_award, 'pr_hit', 'swing', NEW.id, v_new_balance,
        'New personal best'
      );
    EXCEPTION WHEN unique_violation THEN
      -- Already credited for this swing — undo the kids.points_balance bump
      -- so the ledger and the balance stay consistent.
      UPDATE public.kids
         SET points_balance = points_balance - v_award
       WHERE id = NEW.kid_id;
    END;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.detect_swing_pr() OWNER TO postgres;

CREATE TRIGGER trg_swings_detect_pr
  AFTER INSERT ON public.swings
  FOR EACH ROW EXECUTE FUNCTION public.detect_swing_pr();

-- Partial unique index that backs the idempotency guard above. A single swing
-- can only ever generate one 'pr_hit' ledger row.
CREATE UNIQUE INDEX uniq_points_ledger_pr_hit
  ON public.points_ledger (reference_id)
  WHERE reason = 'pr_hit' AND reference_type = 'swing';


-- -----------------------------------------------------------------------------
-- 5. RLS: enable
-- -----------------------------------------------------------------------------
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_capture_links  ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 6. RLS policies
-- -----------------------------------------------------------------------------
-- All four tables are READ-only from the client. Writes go through:
--   * Edge Function hittrax-poll               (sessions, swings — service role)
--   * Trigger detect_swing_pr                  (personal_bests, points_ledger, kids)
--   * Edge Function hittrax-associate          (kid_capture_links insert — service role)
--   * Edge Function hittrax-registration-...   (kid_capture_links update — service role)
--   * Edge Function hittrax-disconnect         (kid_capture_links update — service role)
--
-- Both parents and coaches can read; the kid-ownership join keeps parents
-- scoped to their own family, and coaches see everything in their tenant.

-- sessions: parent SELECT for own family; coach SELECT for own tenant.
-- Defence-in-depth: the families join also pins f.tenant_id = JWT tenant_id.
-- See replit.md "Cross-tenant RLS audit (task #86)" for the same pattern on
-- public.kids — public.swings/sessions/personal_bests/kid_capture_links
-- carry their own tenant_id column AND we re-pin in the join, so even a
-- forged tenant_id row is unreachable.
CREATE POLICY sessions_select_own_family ON public.sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY sessions_select_coach ON public.sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- swings: same pattern.
CREATE POLICY swings_select_own_family ON public.swings
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY swings_select_coach ON public.swings
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- personal_bests: same pattern.
CREATE POLICY personal_bests_select_own_family ON public.personal_bests
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY personal_bests_select_coach ON public.personal_bests
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- kid_capture_links: parent SELECT for own family. Realtime subscription
-- in the mobile app uses this to flip the UI from Pending to Connected
-- when hittrax-registration-complete updates the row.
-- third_party_user_password is a credential. RLS works at row, not column
-- granularity — column-level defence lives in the GRANT below (we never
-- GRANT SELECT on that column to authenticated). The mobile API layer
-- (src/api/hittrax.ts) also uses an explicit column allow-list as a second
-- line of defence.
CREATE POLICY kid_capture_links_select_own_family ON public.kid_capture_links
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY kid_capture_links_select_coach ON public.kid_capture_links
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );


-- -----------------------------------------------------------------------------
-- 7. GRANTs
-- -----------------------------------------------------------------------------
-- All four tables are SELECT-only for authenticated users. Writes happen
-- via service-role Edge Functions / SECURITY DEFINER triggers.
GRANT SELECT ON public.sessions          TO authenticated;
GRANT SELECT ON public.swings            TO authenticated;
GRANT SELECT ON public.personal_bests    TO authenticated;

-- kid_capture_links: COLUMN-LEVEL grant. third_party_user_password is the
-- HitTrax-issued credential — we treat it like a database password and
-- never expose it to authenticated users, even via a forged column-list
-- query. RLS narrows rows but Postgres has no row-level column filter, so
-- defence lives at the GRANT layer:
--   1. (no table-level GRANT SELECT — would allow SELECT *)
--   2. explicit allow-list of every column EXCEPT third_party_user_password
-- src/api/hittrax.ts uses the same allow-list as a second line of defence.
GRANT SELECT (
  id,
  tenant_id,
  kid_id,
  capture_source,
  third_party_user_id,
  external_user_id,
  hittrax_registration_status,
  hittrax_release_status,
  association_status,
  associated_at,
  removed_at,
  last_polled_through,
  last_polled_at,
  last_poll_error,
  created_at,
  updated_at
) ON public.kid_capture_links TO authenticated;

-- service_role needs full DML for the Edge Functions. (Repeats the v0.6
-- service_role grant pattern — see 20260508010000.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swings            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_bests    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kid_capture_links TO service_role;
