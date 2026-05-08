-- =============================================================================
-- v0.7 (task #93 follow-up) — register_device_token SECURITY DEFINER RPC.
-- =============================================================================
-- Why
-- ---
-- The first cut of the client-side upsert (src/services/notifications.ts)
-- tried to handle the "same physical device, different user" case by
-- DELETEing rows for the same expo_push_token belonging to another
-- user_id before upserting. That delete is silently a no-op because RLS
-- on public.device_tokens (see 20260508030000_v07_device_tokens.sql)
-- only permits DELETE when user_id = auth.uid() — i.e. a user can only
-- delete their own rows, never someone else's. A sibling signing in on
-- the same Expo Go app would therefore leave the previous owner's token
-- row intact, and `send-push-notification` would fan a push out to BOTH
-- users for the rest of that token's lifetime — a privacy bug.
--
-- This RPC fixes the gap. It runs as SECURITY DEFINER (owner = postgres,
-- bypasses RLS for its body), but every effect is pinned to:
--   * the JWT-authenticated auth.uid()
--   * the JWT-authenticated tenant_id claim
-- The caller never picks the user_id or tenant_id — they're read from
-- auth.uid() / auth.jwt() inside the function. So a malicious client
-- cannot register a token for somebody else.
--
-- The reassignment + upsert is wrapped in a single transaction so a
-- crash between the two steps cannot leave the token unowned.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.register_device_token(
  p_expo_push_token  text,
  p_platform         text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_tenant_id  uuid := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'register_device_token: not authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'register_device_token: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;
  IF p_expo_push_token IS NULL OR length(p_expo_push_token) = 0 THEN
    RAISE EXCEPTION 'register_device_token: empty token' USING ERRCODE = '22023';
  END IF;
  IF p_platform NOT IN ('ios', 'android', 'web') THEN
    RAISE EXCEPTION 'register_device_token: invalid platform' USING ERRCODE = '22023';
  END IF;

  -- Reassign: drop any rows for this token belonging to a different user.
  -- Runs as DEFINER so RLS does not block the cross-user delete; safe
  -- because we key strictly on the (token, !=current user) tuple.
  DELETE FROM public.device_tokens
   WHERE expo_push_token = p_expo_push_token
     AND user_id <> v_user_id;

  -- Upsert the current owner. Conflict target matches the table's
  -- UNIQUE (user_id, expo_push_token) constraint.
  INSERT INTO public.device_tokens
    (user_id, tenant_id, expo_push_token, platform, last_seen_at)
  VALUES
    (v_user_id, v_tenant_id, p_expo_push_token, p_platform, now())
  ON CONFLICT (user_id, expo_push_token) DO UPDATE
    SET tenant_id    = EXCLUDED.tenant_id,
        platform     = EXCLUDED.platform,
        last_seen_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_device_token(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.register_device_token(text, text) TO authenticated;

COMMENT ON FUNCTION public.register_device_token(text, text) IS
$c$Idempotently register the caller's Expo push token in
public.device_tokens. SECURITY DEFINER so the cross-user
reassignment delete bypasses RLS, but user_id + tenant_id are
read from auth.uid() / auth.jwt() — never from caller input —
so a client cannot impersonate another user. Replaces the
client-side DELETE+upsert pattern, which RLS made into a silent
no-op. See task #93.$c$;
