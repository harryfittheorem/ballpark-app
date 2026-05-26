-- Fix: payment_events table was created without GRANT to authenticated role.
-- RLS policies alone are insufficient — Postgres requires table-level privilege first.
GRANT SELECT ON public.payment_events TO authenticated;
