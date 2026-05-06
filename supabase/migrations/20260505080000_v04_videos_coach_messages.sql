-- =============================================================================
-- Ballpark — v0.4 Step 4.1: videos + coach_messages schema
-- =============================================================================
-- Persistence layer for v0.4 video messaging between coaches and families.
-- Storage bucket (Step 4.4) and Mux webhook Edge Function (Step 4.5) are
-- explicitly out of scope.
--
-- Conventions (carried from v0.1 / v0.3):
--   - Tenant pin on every write policy: USING + WITH CHECK both reference
--     tenant_id = JWT tenant_id, so a caller cannot smuggle a row into
--     another tenant.
--   - App-level role checks read auth.jwt() ->> 'app_role' (NOT 'role',
--     which is reserved by PostgREST for SET ROLE).
--   - Cross-tenant FK guard pattern (per
--     20260505051000_harden_bookings_fk_tenant_pin.sql) is reused on the
--     coach_messages INSERT policy: every referenced FK row must belong
--     to the JWT tenant.
--   - Per-table GRANTs match RLS scope. Parent UPDATE on
--     coach_messages.viewed_at is enforced via column-level GRANT (the
--     cleanest way to express "only this column may change" in Postgres).
--   - Reuses public.set_updated_at() created in the v0.1 initial migration.
--
-- Order: tables (FK order) -> indexes -> updated_at triggers ->
--        RLS enable -> RLS policies -> GRANTs.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- videos ----------------------------------------------------------------------
-- One row per Mux asset uploaded by a coach. v0.4 only the coach inserts;
-- kid/parent uploads land in v0.6 with a widened INSERT policy.
--
-- Lifecycle:
--   uploading  - row created when Direct Upload starts (client-side)
--   processing - Mux acknowledges the bytes, transcoding
--   ready      - Mux webhook flips status + sets mux_playback_id +
--                duration_seconds (webhook runs as service role, bypasses RLS)
--   errored    - Mux failed; client / coach UI shows retry affordance
CREATE TABLE public.videos (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  uploaded_by_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- INVARIANT: mux_asset_id MUST stay NOT NULL + UNIQUE. The mux-webhook
  -- Edge Function (supabase/functions/mux-webhook/index.ts) runs as service
  -- role (bypasses RLS) and keys every UPDATE on this column; uniqueness is
  -- the only thing keeping a forged Mux event from becoming a cross-tenant
  -- write. Guarded by scripts/check-mux-asset-id-constraint.mjs (post-merge)
  -- and supabase/tests/videos_mux_asset_id_constraint.test.sql. Do not relax
  -- without an explicit replacement and an ALLOW-MUX-ASSET-ID-RELAX marker.
  mux_asset_id         text        NOT NULL UNIQUE,
  mux_playback_id      text        UNIQUE,
  duration_seconds     int,
  status               text        NOT NULL DEFAULT 'uploading'
                                   CHECK (status IN ('uploading', 'processing', 'ready', 'errored')),
  title                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT videos_duration_nonneg CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- coach_messages --------------------------------------------------------------
-- One row per chat message in a coach -> family thread. v0.4 is coach-out
-- only; the kid/parent inbound INSERT policy lands in a later v0.4 step
-- on this same table.
--
-- video_id is nullable so the same table carries text-only and video-bearing
-- messages (PRD §3 v0.4: "Unified text + video thread"). The
-- coach_messages_has_content CHECK keeps a row from being entirely empty.
CREATE TABLE public.coach_messages (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  video_id              uuid        REFERENCES public.videos(id) ON DELETE CASCADE,
  sender_user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_family_id   uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  recipient_kid_id      uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  message_text          text,
  viewed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_messages_has_content CHECK (
    video_id IS NOT NULL OR message_text IS NOT NULL
  )
);


-- -----------------------------------------------------------------------------
-- 2. Indexes on every FK column (and a hot lookup key for chat ordering)
-- -----------------------------------------------------------------------------
CREATE INDEX idx_videos_tenant_id                       ON public.videos(tenant_id);
CREATE INDEX idx_videos_uploaded_by_user_id             ON public.videos(uploaded_by_user_id);
-- mux_asset_id / mux_playback_id get UNIQUE indexes for free.

CREATE INDEX idx_coach_messages_tenant_id               ON public.coach_messages(tenant_id);
CREATE INDEX idx_coach_messages_video_id                ON public.coach_messages(video_id);
CREATE INDEX idx_coach_messages_sender_user_id          ON public.coach_messages(sender_user_id);
CREATE INDEX idx_coach_messages_recipient_family_id     ON public.coach_messages(recipient_family_id);
CREATE INDEX idx_coach_messages_recipient_kid_id        ON public.coach_messages(recipient_kid_id);
CREATE INDEX idx_coach_messages_created_at              ON public.coach_messages(created_at DESC);


-- -----------------------------------------------------------------------------
-- 3. updated_at triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_videos_updated_at         BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_coach_messages_updated_at BEFORE UPDATE ON public.coach_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. RLS: enable on both tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.videos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages  ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 5. RLS policies
-- -----------------------------------------------------------------------------

-- videos ---------------------------------------------------------------------

-- Coach can read videos they uploaded.
CREATE POLICY videos_select_own_coach ON public.videos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND uploaded_by_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- Coach can insert rows owned by themselves (tenant-pinned).
CREATE POLICY videos_insert_own_coach ON public.videos
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND uploaded_by_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- Parent can read videos that were actually sent to one of their kids
-- via coach_messages. Anchored on the message join, not on uploader, so
-- the parent never sees a coach's draft / unsent video.
CREATE POLICY videos_select_recipient_parent ON public.videos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.coach_messages cm
        JOIN public.families f ON f.id = cm.recipient_family_id
       WHERE cm.video_id = videos.id
         AND f.parent_user_id = auth.uid()
    )
  );


-- coach_messages -------------------------------------------------------------

-- Coach can read messages they sent.
CREATE POLICY coach_messages_select_own_coach ON public.coach_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND sender_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- Coach insert: tenant-pinned, sender must be self, recipient kid + family
-- must form a real pair belonging to the JWT tenant. The kid_in_family
-- check rules out a coach attaching one family's kid to another family's
-- thread; the f.tenant_id pin closes the cross-tenant FK smuggling vector.
-- If video_id is supplied it must belong to the same tenant too.
CREATE POLICY coach_messages_insert_own_coach ON public.coach_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND sender_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND EXISTS (
      SELECT 1
        FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
       WHERE k.id = coach_messages.recipient_kid_id
         AND f.id = coach_messages.recipient_family_id
         AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND (
      coach_messages.video_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.videos v
         WHERE v.id = coach_messages.video_id
           AND v.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      )
    )
  );

-- Parent can read messages addressed to their family.
CREATE POLICY coach_messages_select_recipient_parent ON public.coach_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND recipient_family_id IN (
      SELECT id FROM public.families WHERE parent_user_id = auth.uid()
    )
  );

-- Parent UPDATE: row scope is "messages addressed to my family".
-- The column-level GRANT below restricts which columns the UPDATE may
-- touch (only viewed_at), so a parent cannot rewrite message_text /
-- recipient_* / etc. via this policy.
CREATE POLICY coach_messages_update_recipient_parent ON public.coach_messages
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND recipient_family_id IN (
      SELECT id FROM public.families WHERE parent_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND recipient_family_id IN (
      SELECT id FROM public.families WHERE parent_user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 6. GRANTs (RLS narrows rows; GRANTs gate the verb).
--    Privilege model:
--      videos          authenticated: SELECT, INSERT
--      coach_messages  authenticated: SELECT, INSERT, UPDATE(viewed_at)
--
--    Note the column-level GRANT on coach_messages: PostgreSQL will reject
--    any UPDATE that targets a column not in the granted set, so the
--    parent UPDATE policy can only ever change viewed_at.
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT             ON public.videos          TO authenticated;
GRANT SELECT, INSERT             ON public.coach_messages  TO authenticated;
GRANT UPDATE (viewed_at)         ON public.coach_messages  TO authenticated;
