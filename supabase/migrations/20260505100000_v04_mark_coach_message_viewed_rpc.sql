-- =============================================================================
-- Ballpark — v0.4 Step 4.13: mark_coach_message_viewed RPC
-- =============================================================================
-- Wraps the parent's "mark this coach video viewed" UPDATE in a server-side
-- function so `viewed_at` is stamped with the database's `now()` instead of
-- the client's wall clock (which can drift, especially on phones in airplane
-- mode toggles or across time zones during travel).
--
-- SECURITY INVOKER (the default) so RLS + the column-level GRANT on
-- coach_messages.viewed_at from 20260505080000 still apply — the function
-- isn't an end-run around either of them. The body's `viewed_at IS NULL`
-- filter keeps the call idempotent: re-opens are 0-row no-ops.
--
-- search_path is pinned to `public, pg_temp` per Supabase's hardening
-- guidance to prevent search_path hijacking via temp objects.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_coach_message_viewed(p_message_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  UPDATE public.coach_messages
     SET viewed_at = now()
   WHERE id = p_message_id
     AND viewed_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.mark_coach_message_viewed(uuid) TO authenticated;
