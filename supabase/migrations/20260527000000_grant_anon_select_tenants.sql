-- Grant anon SELECT on tenants so the signup flow can resolve a tenant slug
-- to its UUID without requiring authentication. The tenants table contains
-- only public franchise information (name, slug, timezone) — nothing sensitive.
GRANT SELECT ON public.tenants TO anon;
