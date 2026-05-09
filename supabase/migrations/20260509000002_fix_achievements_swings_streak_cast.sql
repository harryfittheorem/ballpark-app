-- Fix: _achievements_after_swings streak calculation used ROW_NUMBER() which
-- returns bigint, but the date - bigint operator does not exist in PostgreSQL.
-- Cast (rn - 1) to integer so date subtraction resolves correctly.
-- Symptom: any INSERT into public.swings raised
--   "operator does not exist: date - bigint" (pg error 42883).

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

  -- Distinct-day streak ending today. ROW_NUMBER() returns bigint, so cast
  -- to integer before subtracting from a date (date - integer = date).
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
   WHERE d = (CURRENT_DATE - (rn - 1)::integer);

  IF v_streak >= 7 THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'streak_7');
  END IF;
  IF v_streak >= 30 THEN
    PERFORM public._grant_achievement(NEW.kid_id, 'streak_30');
  END IF;

  RETURN NEW;
END;
$$;
