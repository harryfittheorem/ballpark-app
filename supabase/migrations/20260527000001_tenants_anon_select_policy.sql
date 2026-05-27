-- Allow unauthenticated (anon) reads on tenants so the signup flow can
-- resolve a tenant slug to its UUID before the user has a session.
-- Tenants contains only public franchise info (name, slug, brand colours).
CREATE POLICY "anon can read tenants"
  ON public.tenants
  FOR SELECT
  TO anon
  USING (true);
