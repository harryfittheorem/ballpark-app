-- Fix: promo_codes table was created without GRANT to authenticated role.
-- RLS policies alone are insufficient — Postgres requires table-level privilege first.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
