-- =============================================================================
-- Ballpark — v0.7 task #122
-- Achievements catalog + grant pipeline + redemption fulfillment
-- =============================================================================
-- Adds:
--   * public.achievements           — HQ-curated catalog (one row per badge)
--   * public.kid_achievements       — per-kid earned-at log (idempotent)
--   * public._grant_achievement(kid, key) function — INSERTS the kid row
--                                     ON CONFLICT DO NOTHING; on a real
--                                     grant it writes the points_ledger
--                                     bonus and fires a pg_net.http_post
--                                     to the notify-achievement Edge Func.
--   * Five trigger functions (one per source table) calling _grant_achievement
--     for the achievement keys eligible to be earned by that source's INSERT:
--        - points_ledger    -> first_session_attended, first_pr,
--                              first_reward_redeemed, ten_assignments_completed
--        - swings           -> first_swing, fifty_swings, hundred_swings,
--                              streak_7, streak_30
--        - personal_bests   -> first_pr (defence-in-depth — points_ledger
--                              also fires it via reason='pr_hit')
--        - orders           -> first_reward_redeemed (defence-in-depth)
--        - coach_messages   -> first_video_to_coach (parent_to_coach only)
--        - assignments      -> homework_5_star (on review with rating=5)
--   * orders.fulfilled_by_user_id   — admin who closed the redemption out
--   * mark_redemption_fulfilled(p_code) SECURITY DEFINER RPC for the
--     portal /admin/redemptions page.
--   * points_ledger.reason CHECK extended with 'achievement_bonus'
--   * points_ledger.reference_type CHECK extended with 'achievement'
--   * Idempotency: partial UNIQUE on points_ledger for achievement bonuses
--     keyed on (reference_id) WHERE reason='achievement_bonus'.
--
-- Notes:
--   * pg_net is part of Supabase by default; the http_post is best-effort
--     so a missing extension never blocks the trigger fire path (we wrap
--     in EXCEPTION WHEN OTHERS).
--   * Catalog seed runs at the bottom of this file and is idempotent
--     against the UNIQUE(key) constraint.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. achievements catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text        NOT NULL UNIQUE,
  name          text        NOT NULL,
  description   text        NOT NULL,
  icon          text        NOT NULL,                  -- lucide-react-native icon name
  points_bonus  int         NOT NULL DEFAULT 0 CHECK (points_bonus >= 0),
  sort_order    int         NOT NULL DEFAULT 100,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. kid_achievements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kid_achievements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id          uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  achievement_id  uuid        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kid_achievements_kid_achievement_unique UNIQUE (kid_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_kid_achievements_kid    ON public.kid_achievements(kid_id);
CREATE INDEX IF NOT EXISTS idx_kid_achievements_tenant ON public.kid_achievements(tenant_id);

-- -----------------------------------------------------------------------------
-- 3. orders.fulfilled_by_user_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fulfilled_by ON public.orders(fulfilled_by_user_id);

-- -----------------------------------------------------------------------------
-- 4. Extend points_ledger.reason / reference_type CHECK
-- -----------------------------------------------------------------------------
ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_reason_check;
ALTER TABLE public.points_ledger
  ADD CONSTRAINT points_ledger_reason_check CHECK (reason IN (
    'session_attended',
    'assignment_completed',
    'pr_hit',
    'redemption',
    'manual_adjustment',
    'achievement_bonus'
  ));

ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_reference_type_check;
ALTER TABLE public.points_ledger
  ADD CONSTRAINT points_ledger_reference_type_check CHECK (
    reference_type IS NULL OR reference_type IN ('booking', 'order', 'assignment', 'swing', 'manual', 'achievement')
  );

-- Idempotency: one ledger row per (kid, achievement) bonus
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_ledger_achievement_bonus
  ON public.points_ledger (reference_id)
  WHERE reason = 'achievement_bonus' AND reference_type = 'achievement';

-- -----------------------------------------------------------------------------
-- 5. _grant_achievement(kid, key)
--
-- INSERTs the kid_achievements row ON CONFLICT DO NOTHING. If a row was
-- actually inserted (RETURNING produced one), this also:
--   (a) writes a points_ledger row with reason='achievement_bonus' if the
--       achievement carries a points_bonus > 0. Idempotent via the
--       partial UNIQUE on (reference_id).
--   (b) fires pg_net.http_post to notify-achievement Edge Function so the
--       parent gets a push. Best-effort; failures are swallowed.
--
-- SECURITY DEFINER so the triggers (which run in the inserting user's
-- context) can write through RLS on points_ledger / kid_achievements.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._grant_achievement(p_kid_id uuid, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_achievement public.achievements%ROWTYPE;
  v_tenant_id   uuid;
  v_balance     int;
  v_new_kid_ach uuid;
  v_supabase_url text;
  v_service_key  text;
BEGIN
  -- Look up the achievement; silently no-op for unknown keys so a typo in
  -- a trigger never breaks the inserting transaction.
  SELECT * INTO v_achievement FROM public.achievements WHERE key = p_key;
  IF NOT FOUND THEN RETURN; END IF;

  -- Resolve the kid's tenant. If the kid was deleted between trigger fire
  -- and now, no-op.
  SELECT tenant_id INTO v_tenant_id FROM public.kids WHERE id = p_kid_id;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- Idempotent insert. RETURNING surfaces the new id only on a real
  -- insert (not on an ON CONFLICT skip).
  INSERT INTO public.kid_achievements (tenant_id, kid_id, achievement_id)
       VALUES (v_tenant_id, p_kid_id, v_achievement.id)
  ON CONFLICT (kid_id, achievement_id) DO NOTHING
  RETURNING id INTO v_new_kid_ach;

  IF v_new_kid_ach IS NULL THEN
    -- Already earned. Nothing else to do.
    RETURN;
  END IF;

  -- Points bonus, if any.
  IF v_achievement.points_bonus > 0 THEN
    UPDATE public.kids
       SET points_balance = points_balance + v_achievement.points_bonus
     WHERE id = p_kid_id
     RETURNING points_balance INTO v_balance;

    INSERT INTO public.points_ledger (
      tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
    ) VALUES (
      v_tenant_id, p_kid_id, v_achievement.points_bonus, 'achievement_bonus',
      'achievement', v_new_kid_ach, v_balance, v_achievement.name
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Best-effort push fan-out via pg_net + Edge Function.
  -- Wrapped in BEGIN/EXCEPTION so a missing extension or bad config
  -- never blocks the trigger.
  BEGIN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key  := current_setting('app.settings.service_role_key', true);
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL
       AND v_supabase_url <> '' AND v_service_key <> '' THEN
      PERFORM extensions.http_post(
        url     := v_supabase_url || '/functions/v1/notify-achievement',
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer ' || v_service_key
                   ),
        body    := jsonb_build_object(
                     'kid_id',         p_kid_id,
                     'achievement_id', v_achievement.id,
                     'achievement_key', v_achievement.key
                   )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; achievement is granted regardless
    NULL;
  END;
END;
$$;

ALTER FUNCTION public._grant_achievement(uuid, text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public._grant_achievement(uuid, text) FROM public, anon, authenticated;
-- service_role only (triggers escalate via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public._grant_achievement(uuid, text) TO service_role;


-- -----------------------------------------------------------------------------
-- 6. Trigger fns + triggers
-- -----------------------------------------------------------------------------

-- 6a. points_ledger -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public._achievements_after_points_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.reason = 'session_attended' THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_session_attended');
  ELSIF NEW.reason = 'pr_hit' THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_pr');
  ELSIF NEW.reason = 'redemption' THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_reward_redeemed');
  ELSIF NEW.reason = 'assignment_completed' THEN
    SELECT COUNT(*) INTO v_count
      FROM public.points_ledger
     WHERE kid_id = NEW.kid_id AND reason = 'assignment_completed';
    IF v_count >= 1 THEN
      PERFORM public._grant_achievement(NEW.kid_id, 'first_assignment_done');
    END IF;
    IF v_count >= 10 THEN
      PERFORM public._grant_achievement(NEW.kid_id, 'ten_assignments_done');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_after_points_ledger ON public.points_ledger;
CREATE TRIGGER trg_achievements_after_points_ledger
AFTER INSERT ON public.points_ledger
FOR EACH ROW EXECUTE FUNCTION public._achievements_after_points_ledger();


-- 6b. swings ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._achievements_after_swings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
  v_streak int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.swings WHERE kid_id = NEW.kid_id;

  IF v_count >= 1 THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_swing');
  END IF;
  IF v_count >= 50 THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'fifty_swings');
  END IF;
  IF v_count >= 100 THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'hundred_swings');
  END IF;

  -- Distinct-day streak ending today (or NEW.occurred_at). Cheap because
  -- swings are heavily indexed by kid_id; cap at 31 days back.
  WITH days AS (
    SELECT DISTINCT (occurred_at AT TIME ZONE 'UTC')::date AS d
      FROM public.swings
     WHERE kid_id = NEW.kid_id
       AND occurred_at >= now() - INTERVAL '40 days'
  ),
  ordered AS (
    SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) AS rn FROM days
  )
  SELECT COUNT(*) INTO v_streak
    FROM ordered
   WHERE d = (CURRENT_DATE - (rn - 1));

  IF v_streak >= 7 THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'streak_7');
  END IF;
  IF v_streak >= 30 THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'streak_30');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_after_swings ON public.swings;
CREATE TRIGGER trg_achievements_after_swings
AFTER INSERT ON public.swings
FOR EACH ROW EXECUTE FUNCTION public._achievements_after_swings();


-- 6c. personal_bests (defence-in-depth for first_pr) -------------------------
CREATE OR REPLACE FUNCTION public._achievements_after_personal_bests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public._grant_achievement(NEW.kid_id, 'first_pr');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_after_personal_bests ON public.personal_bests;
CREATE TRIGGER trg_achievements_after_personal_bests
AFTER INSERT ON public.personal_bests
FOR EACH ROW EXECUTE FUNCTION public._achievements_after_personal_bests();


-- 6d. orders (defence-in-depth for first_reward_redeemed) -------------------
CREATE OR REPLACE FUNCTION public._achievements_after_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_method = 'points' AND NEW.kid_id IS NOT NULL THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'first_reward_redeemed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_after_orders ON public.orders;
CREATE TRIGGER trg_achievements_after_orders
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._achievements_after_orders();


-- 6e. coach_messages (parent_to_coach -> first_video_to_coach) ---------------
CREATE OR REPLACE FUNCTION public._achievements_after_coach_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kid_id uuid;
  v_purpose text;
BEGIN
  IF NEW.video_id IS NULL THEN RETURN NEW; END IF;

  SELECT purpose INTO v_purpose FROM public.videos WHERE id = NEW.video_id;
  IF v_purpose IS DISTINCT FROM 'parent_to_coach' THEN RETURN NEW; END IF;

  -- The recipient kid is the kid the parent recorded about.
  v_kid_id := NEW.recipient_kid_id;
  IF v_kid_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public._grant_achievement(v_kid_id, 'first_video_to_coach');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_after_coach_messages ON public.coach_messages;
CREATE TRIGGER trg_achievements_after_coach_messages
AFTER INSERT ON public.coach_messages
FOR EACH ROW EXECUTE FUNCTION public._achievements_after_coach_messages();


-- 6f. assignments (homework_5_star) ------------------------------------------
CREATE OR REPLACE FUNCTION public._achievements_after_assignments_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_supabase_url text;
  v_service_key  text;
BEGIN
  IF NEW.status = 'reviewed' AND OLD.status IS DISTINCT FROM 'reviewed' THEN
    -- 5-star homework achievement
    IF NEW.rating = 5 THEN
      PERFORM public._grant_achievement(NEW.kid_id, 'homework_5_star');
    END IF;

    -- Best-effort push fan-out to notify-assignment-reviewed.
    BEGIN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_key  := current_setting('app.settings.service_role_key', true);
      IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL
         AND v_supabase_url <> '' AND v_service_key <> '' THEN
        PERFORM extensions.http_post(
          url     := v_supabase_url || '/functions/v1/notify-assignment-reviewed',
          headers := jsonb_build_object(
                       'Content-Type',  'application/json',
                       'Authorization', 'Bearer ' || v_service_key
                     ),
          body    := jsonb_build_object('assignment_id', NEW.id)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_after_assignments_review ON public.assignments;
CREATE TRIGGER trg_achievements_after_assignments_review
AFTER UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public._achievements_after_assignments_review();


-- -----------------------------------------------------------------------------
-- 7. mark_redemption_fulfilled(p_code) RPC
--
-- Admin-only (verifies app_role='admin' on the JWT). Stamps fulfilled_at
-- + fulfilled_by_user_id and flips status from 'pending' to 'fulfilled'.
-- Idempotent: re-running on an already-fulfilled order returns it
-- unchanged (no error) so a double-tap from the front-desk surface
-- never throws.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_redemption_fulfilled(p_code text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_app_role  text := auth.jwt() ->> 'app_role';
  v_jwt_tenant_id uuid;
  v_order     public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: not authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_app_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: caller is not an admin' USING ERRCODE = '42501';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE redemption_code = upper(btrim(p_code))
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: code % not found', p_code USING ERRCODE = 'P0002';
  END IF;
  IF v_order.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_order.fulfilled_at IS NOT NULL THEN
    RETURN v_order;  -- idempotent re-tap on an already-fulfilled order
  END IF;

  -- Hard guards: this surface is points-only ordered redemptions. Card
  -- orders go through a separate Stripe flow (v0.5 deferred); cancelled
  -- / refunded orders are terminal. Refuse instead of mutating so a
  -- mistyped code never silently flips an unrelated order to fulfilled.
  IF v_order.payment_method <> 'points' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: order % is %, only points redemptions can be fulfilled here',
      v_order.id, v_order.payment_method
      USING ERRCODE = 'P0001';
  END IF;
  IF v_order.status <> 'ordered' THEN
    RAISE EXCEPTION 'mark_redemption_fulfilled: order % status is %, expected ordered',
      v_order.id, v_order.status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
     SET status               = 'fulfilled',
         fulfilled_at         = now(),
         fulfilled_by_user_id = v_user_id
   WHERE id = v_order.id
   RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

ALTER FUNCTION public.mark_redemption_fulfilled(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.mark_redemption_fulfilled(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mark_redemption_fulfilled(text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.achievements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_achievements  ENABLE ROW LEVEL SECURITY;

-- achievements: every authenticated user reads the whole catalog (it's
-- HQ-curated and tenant-agnostic). No INSERT/UPDATE/DELETE policy — only
-- service_role writes.
DROP POLICY IF EXISTS achievements_select_all ON public.achievements;
CREATE POLICY achievements_select_all ON public.achievements
  FOR SELECT TO authenticated
  USING (true);

-- kid_achievements: parent reads own family's; coach reads own tenant's;
-- admin reads own tenant's. Writes are SECURITY DEFINER only.
DROP POLICY IF EXISTS kid_achievements_select_own_family ON public.kid_achievements;
CREATE POLICY kid_achievements_select_own_family ON public.kid_achievements
  FOR SELECT TO authenticated
  USING (
    kid_id IN (
      SELECT k.id FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
       WHERE f.parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS kid_achievements_select_tenant_staff ON public.kid_achievements;
CREATE POLICY kid_achievements_select_tenant_staff ON public.kid_achievements
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') IN ('coach', 'admin')
    AND tenant_id = NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid
  );

GRANT SELECT ON public.achievements     TO authenticated;
GRANT SELECT ON public.kid_achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kid_achievements TO service_role;


-- -----------------------------------------------------------------------------
-- 7c. notification_log — durable per-period dedupe for fan-out jobs
--
-- Keyed by (tenant_id, kid_id, event_type, period_key). The
-- notify-leaderboard-weekly function inserts a row before sending; the
-- UNIQUE constraint guarantees the push only fires once per ISO week
-- per (kid, event), no matter how many times the cron / operator
-- re-invokes the function. Other best-effort jobs can adopt the same
-- table by picking their own `period_key` convention (daily, hourly,
-- one-shot UUID, etc).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id      uuid NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  user_id     uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  period_key  text NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_notification_log_kid_event_period
  ON public.notification_log (tenant_id, kid_id, event_type, period_key)
  WHERE kid_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_notification_log_user_event_period
  ON public.notification_log (tenant_id, user_id, event_type, period_key)
  WHERE user_id IS NOT NULL AND kid_id IS NULL;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
-- No client policies — service-role only.
GRANT SELECT, INSERT ON public.notification_log TO service_role;


-- -----------------------------------------------------------------------------
-- 7b. get_kid_weekly_rank_delta(p_kid_id) RPC
--
-- Returns how many ranks a kid has climbed (+) or dropped (-) over the
-- past 7 days within their own tenant. SECURITY DEFINER so the
-- reconstruction can read every kid + ledger row in the tenant — the
-- standard parent RLS on points_ledger hides other kids' deltas, which
-- would skew the old ranking. The function explicitly pins to the
-- caller's JWT tenant_id and verifies the kid lives in that tenant
-- before returning anything, so this widens read access by *exactly* the
-- one number the parent already needs (their own kid's rank delta) and
-- nothing else.
--
-- Returns NULL if the kid is not in the tenant's top-50 leaderboard
-- (matches the live RanksScreen cap).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_kid_weekly_rank_delta(p_kid_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_tenant_id uuid := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  v_kid_tenant_id uuid;
  v_rank_now      int;
  v_rank_then     int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'get_kid_weekly_rank_delta: not authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'get_kid_weekly_rank_delta: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  -- `kids` has no direct tenant_id column — tenant lives on families.
  SELECT f.tenant_id
    INTO v_kid_tenant_id
    FROM public.kids k
    JOIN public.families f ON f.id = k.family_id
   WHERE k.id = p_kid_id;
  IF v_kid_tenant_id IS NULL OR v_kid_tenant_id <> v_jwt_tenant_id THEN
    -- Refuse to leak across tenants. NULL signals "no rank data".
    RETURN NULL;
  END IF;

  WITH top50 AS (
    SELECT k.id, k.points_balance
      FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
     WHERE f.tenant_id = v_jwt_tenant_id
     ORDER BY k.points_balance DESC
     LIMIT 50
  ),
  ranked_now AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY points_balance DESC, id) AS rnk FROM top50
  ),
  recent AS (
    SELECT pl.kid_id, COALESCE(SUM(pl.delta), 0)::int AS d
      FROM public.points_ledger pl
     WHERE pl.tenant_id = v_jwt_tenant_id
       AND pl.created_at >= now() - INTERVAL '7 days'
     GROUP BY pl.kid_id
  ),
  ranked_then AS (
    SELECT t.id,
           ROW_NUMBER() OVER (
             ORDER BY (t.points_balance - COALESCE(r.d, 0)) DESC, t.id
           ) AS rnk
      FROM top50 t
      LEFT JOIN recent r ON r.kid_id = t.id
  )
  SELECT (SELECT rnk FROM ranked_then WHERE id = p_kid_id),
         (SELECT rnk FROM ranked_now  WHERE id = p_kid_id)
    INTO v_rank_then, v_rank_now;

  IF v_rank_now IS NULL OR v_rank_then IS NULL THEN RETURN NULL; END IF;

  -- Positive = climbed (lower rank number is better).
  RETURN v_rank_then - v_rank_now;
END;
$$;

ALTER FUNCTION public.get_kid_weekly_rank_delta(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_kid_weekly_rank_delta(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_kid_weekly_rank_delta(uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 8b. Admin SELECT policies needed by /admin/redemptions
--
-- Existing policies cover parent + coach reads for orders/kids/families,
-- but not admin. The portal admin page joins orders -> products / kids,
-- so add narrow tenant-scoped admin SELECT policies on each.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_select_admin ON public.orders;
CREATE POLICY orders_select_admin ON public.orders
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid
  );

DROP POLICY IF EXISTS kids_select_admin ON public.kids;
CREATE POLICY kids_select_admin ON public.kids
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND family_id IN (
      SELECT id FROM public.families
       WHERE tenant_id = NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid
    )
  );

DROP POLICY IF EXISTS families_select_admin ON public.families;
CREATE POLICY families_select_admin ON public.families
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid
  );


-- -----------------------------------------------------------------------------
-- 9. Catalog seed (12 achievements)
-- -----------------------------------------------------------------------------
INSERT INTO public.achievements (key, name, description, icon, points_bonus, sort_order) VALUES
  ('first_swing',             'First Swing',          'Logged your very first swing.',                   'Sparkles',     10,  10),
  ('fifty_swings',            '50 Swings',            'Logged 50 swings — putting in the work.',         'Target',       25,  20),
  ('hundred_swings',          '100 Swings',           'Logged 100 swings — that is dedication.',         'Trophy',       50,  30),
  ('first_pr',                'First Personal Best',  'Set your first PR.',                              'Award',        25,  40),
  ('streak_7',                '7-Day Streak',         'Logged swings on 7 different days in a row.',     'Flame',        50,  50),
  ('streak_30',               '30-Day Streak',        'Logged swings on 30 different days in a row.',    'Flame',       150,  60),
  ('first_session_attended',  'First Session',        'Showed up for your first booked session.',        'CalendarCheck', 10, 70),
  ('first_assignment_done',   'First Homework',       'Completed your first coach assignment.',          'BookCheck',    15,  80),
  ('ten_assignments_done',    '10 Assignments',       'Completed 10 coach assignments.',                 'GraduationCap', 75, 90),
  ('homework_5_star',         '5-Star Homework',      'Earned a 5-star review on a coach assignment.',   'Star',         30, 100),
  ('first_reward_redeemed',   'First Reward',         'Redeemed your first reward.',                     'Gift',         10, 110),
  ('first_video_to_coach',    'Coach Up',             'Sent your first video to a coach.',               'Video',        15, 120),
  ('top_10_leaderboard',      'Top 10',               'Cracked the top 10 on the tenant leaderboard.',   'Crown',       100, 130)
ON CONFLICT (key) DO UPDATE
  SET name         = EXCLUDED.name,
      description  = EXCLUDED.description,
      icon         = EXCLUDED.icon,
      points_bonus = EXCLUDED.points_bonus,
      sort_order   = EXCLUDED.sort_order;
