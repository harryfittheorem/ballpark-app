-- Self-reported game stats (W21)
-- Players/parents log game performance from outside the facility.
-- Owners and coaches can view in portal; contributes to engagement score.

CREATE TABLE IF NOT EXISTS public.self_reported_games (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id          uuid NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  reported_by     uuid REFERENCES auth.users(id),
  game_date       date NOT NULL,
  opponent        text,
  result          text CHECK (result IN ('win', 'loss', 'tie', 'scrimmage')),
  at_bats         int CHECK (at_bats >= 0),
  hits            int CHECK (hits >= 0),
  home_runs       int CHECK (home_runs >= 0),
  rbi             int CHECK (rbi >= 0),
  avg_exit_velo   numeric(5,1),
  peak_exit_velo  numeric(5,1),
  notes           text,
  source          text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner', 'coach', 'parent', 'player')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS self_reported_games_kid_date
  ON public.self_reported_games (kid_id, game_date DESC);

CREATE INDEX IF NOT EXISTS self_reported_games_tenant
  ON public.self_reported_games (tenant_id, game_date DESC);

ALTER TABLE public.self_reported_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_reported_games_read ON public.self_reported_games
  FOR SELECT TO authenticated USING (true);

CREATE POLICY self_reported_games_write ON public.self_reported_games
  FOR INSERT TO authenticated WITH CHECK (true);

COMMENT ON TABLE public.self_reported_games IS
  'Game stats self-reported by owners, coaches, parents, or players. Used for engagement tracking and member profiles (W21).';
