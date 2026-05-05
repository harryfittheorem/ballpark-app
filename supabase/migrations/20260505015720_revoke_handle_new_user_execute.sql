-- =============================================================================
-- Revoke EXECUTE on handle_new_user from public roles
-- =============================================================================
-- handle_new_user is only ever invoked by the AFTER INSERT trigger on
-- auth.users, which postgres dispatches directly — no role needs EXECUTE
-- on it. Revoking from public/anon/authenticated/supabase_auth_admin
-- removes a latent privilege escalation surface (a SECURITY DEFINER
-- function that inserts into public.families and trusts metadata should
-- never be directly callable).
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
