-- Fix infinite RLS recursion: coaches ↔ coach_locations cycle
--
-- Root cause (introduced when coaches_admin_select_staff_locations was added):
--   1. Any query on bookings JOINs coaches
--   2. coaches RLS evaluates coaches_admin_select_staff_locations
--      → subquery on coach_locations
--   3. coach_locations RLS evaluates coach_locations_select_own
--      → subquery on coaches  ← triggers coaches RLS again → ∞
--
-- Fix: replace the coaches subquery inside coach_locations_select_own with a
-- SECURITY DEFINER helper that bypasses RLS, breaking the cycle at step 3.

CREATE OR REPLACE FUNCTION public.get_my_coach_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.coaches WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_coach_id() TO authenticated;

-- Recreate the policy using the SECURITY DEFINER function (no coaches RLS triggered)
DROP POLICY IF EXISTS coach_locations_select_own ON public.coach_locations;

CREATE POLICY coach_locations_select_own ON public.coach_locations
  FOR SELECT TO authenticated
  USING (coach_id = public.get_my_coach_id());
