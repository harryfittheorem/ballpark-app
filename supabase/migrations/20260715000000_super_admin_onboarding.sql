-- =============================================================================
-- Ballpark — Task #278: Super Admin Web Onboarding
-- Tables: platform_init, hq_audit_log, hq_invites
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. platform_init — single-row atomic initialization record.
--    CHECK (id = 1) physically enforces exactly one row; the INSERT in the
--    bootstrap API uses this as a distributed lock (second concurrent INSERT
--    fails with unique violation and the losing request cleans up).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_init (
  id                     int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  initialized_at         timestamptz NOT NULL DEFAULT now(),
  initialized_by_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Not exposed to RLS — only the service role touches this table from API routes.


-- ---------------------------------------------------------------------------
-- 2. hq_audit_log — immutable, append-only trail for every privileged HQ action.
--    Super admins can SELECT; all writes go through service role in API routes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hq_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text        NOT NULL,
  target_email  text,
  ip            text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hq_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY hq_audit_log_select_super_admin ON public.hq_audit_log
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');

GRANT SELECT ON public.hq_audit_log TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. hq_invites — CSPRNG-token invite system for super_admin onboarding.
--    Only the SHA-256 hash of the raw token is stored; the raw token is sent
--    once in the invite email and never persisted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hq_invites (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text        NOT NULL,
  token_hash          text        NOT NULL UNIQUE,
  role                text        NOT NULL DEFAULT 'super_admin'
                        CHECK (role IN ('super_admin')),
  invited_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'claimed', 'revoked', 'superseded', 'expired')),
  expires_at          timestamptz NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  claimed_at          timestamptz,
  claimed_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enforce exactly one active (pending) invite per email at a time.
CREATE UNIQUE INDEX IF NOT EXISTS hq_invites_email_pending_unique
  ON public.hq_invites (email)
  WHERE status = 'pending';

ALTER TABLE public.hq_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY hq_invites_select_super_admin ON public.hq_invites
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'app_role') = 'super_admin');

GRANT SELECT ON public.hq_invites TO authenticated;
