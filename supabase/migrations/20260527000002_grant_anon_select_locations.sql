-- Allow unauthenticated (anon) reads on locations so the signup flow can
-- display the location picker before the user has a session.
-- Locations contains only public facility info (name, city, state, timezone).
GRANT SELECT ON public.locations TO anon;

CREATE POLICY "anon can read locations"
  ON public.locations
  FOR SELECT
  TO anon
  USING (true);
