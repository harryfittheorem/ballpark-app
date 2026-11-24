-- Grant table privileges after DROP/recreate in previous migration.
-- DROP TABLE CASCADE removes default Supabase schema grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.self_reported_games TO authenticated;
GRANT ALL ON public.self_reported_games TO service_role;
