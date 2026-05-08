-- =============================================================================
-- v0.7 (task #93) — device_tokens: Expo push token persistence per user.
-- =============================================================================
-- Problem
-- -------
-- The client already requests an Expo push token after a successful sign-in
-- (src/services/notifications.ts -> registerForPushNotifications), but
-- there's no server-side place to store it, so nothing can fan a push out.
-- This table is the persistence layer behind two new Edge Functions:
--   * send-push-notification           (service-role only, generic fan-out)
--   * send-coach-video-notification    (called from mux-webhook on
--                                       video.asset.ready for coach_message
--                                       videos; also delivers Resend email)
--
-- Multi-tenancy & uniqueness
-- --------------------------
-- Every other table in this schema carries tenant_id pinned to the JWT
-- claim; device_tokens follows the same convention so RLS can be expressed
-- as a defence-in-depth (user_id = auth.uid()) AND
-- (tenant_id = JWT tenant_id) check.
--
-- We DO NOT put a UNIQUE on expo_push_token alone — the same physical
-- device can re-register under a different user (account switch on Expo
-- Go, family handing the phone to a sibling, etc.) and a global UNIQUE
-- would 409 forever. The composite UNIQUE (user_id, expo_push_token) lets
-- the client `upsert` cleanly. To prevent the same Expo token from being
-- attributed to two users at the same moment, the client upsert path
-- ALSO deletes any other row with the same expo_push_token belonging to
-- a different user (see src/services/notifications.ts).
--
-- last_seen_at is bumped on every successful registration so a future
-- prune job can drop tokens we haven't refreshed in N days.
-- =============================================================================


-- 1. Table ------------------------------------------------------------------
CREATE TABLE public.device_tokens (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token   text        NOT NULL,
  platform          text        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_user_token_uniq UNIQUE (user_id, expo_push_token)
);

COMMENT ON TABLE public.device_tokens IS
$c$Expo push tokens, one row per (user, device). Composite uniqueness on
(user_id, expo_push_token) — never a global unique on the token alone, so
the same physical device can switch between accounts without a permanent
409. The client upsert path additionally reassigns any pre-existing row
for the same expo_push_token belonging to a different user_id.$c$;


-- 2. Indexes ----------------------------------------------------------------
CREATE INDEX idx_device_tokens_user_id   ON public.device_tokens(user_id);
CREATE INDEX idx_device_tokens_tenant_id ON public.device_tokens(tenant_id);


-- 3. updated_at trigger -----------------------------------------------------
CREATE TRIGGER trg_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4. RLS --------------------------------------------------------------------
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- A signed-in user can SELECT/INSERT/UPDATE/DELETE only their own tokens
-- in their own tenant. The service-role client (used by the two new Edge
-- Functions) bypasses RLS entirely for fan-out reads.

CREATE POLICY device_tokens_select_own ON public.device_tokens
  FOR SELECT TO authenticated
  USING (
    user_id   = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY device_tokens_insert_own ON public.device_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id   = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY device_tokens_update_own ON public.device_tokens
  FOR UPDATE TO authenticated
  USING (
    user_id   = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    user_id   = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY device_tokens_delete_own ON public.device_tokens
  FOR DELETE TO authenticated
  USING (
    user_id   = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );


-- 5. GRANTs (per replit.md gotcha — raw-SQL tables don't inherit defaults)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO service_role;
