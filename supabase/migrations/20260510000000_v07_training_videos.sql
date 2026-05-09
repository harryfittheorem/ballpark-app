-- =============================================================================
-- v0.7 task #121 — Training video library
-- =============================================================================
-- Self-serve catalog of HQ-curated training videos exposed in the mobile
-- Train tab. Tenant-scoped so a future second tenant gets its own library.
--
-- Tables:
--   training_videos       the catalog row (one Mux asset + metadata).
--   training_video_views  per-kid view log (analytics + future
--                         personalization). view_count on the parent row
--                         is denormalized via the record_training_view RPC.
--
-- RPC:
--   record_training_view(p_video_id uuid, p_kid_id uuid)
--     SECURITY DEFINER. Inserts a view row + bumps view_count atomically.
--     Tenant + kid ownership are enforced inside the function so the
--     client can't smuggle a foreign kid_id.
--
-- RLS:
--   training_videos
--     SELECT  any signed-in user in the same tenant where published_at
--             IS NOT NULL (parents and coaches see published rows only).
--             Admins see all rows including drafts.
--     INSERT/UPDATE/DELETE  app_role='admin' AND tenant matches.
--   training_video_views
--     SELECT  parent on their own family's kids; admin on their tenant.
--     INSERT  blocked at the policy level — only the SECURITY DEFINER RPC
--             writes here, so the client cannot fabricate inflated views.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.training_videos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mux_playback_id text        NOT NULL,
  title           text        NOT NULL,
  description     text,
  category        text        NOT NULL CHECK (category IN ('hitting','mental','situational','fielding')),
  level           text        NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
  coach_name      text,
  duration_sec    integer     CHECK (duration_sec IS NULL OR duration_sec >= 0),
  view_count      integer     NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  featured        boolean     NOT NULL DEFAULT false,
  published_at    timestamptz,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_videos_tenant_published_idx
  ON public.training_videos (tenant_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS training_videos_tenant_category_idx
  ON public.training_videos (tenant_id, category, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS training_videos_tenant_featured_idx
  ON public.training_videos (tenant_id, featured, published_at DESC NULLS LAST)
  WHERE featured = true AND published_at IS NOT NULL;

COMMENT ON TABLE public.training_videos IS
  'HQ-curated training video catalog (v0.7 task #121). One row per Mux asset.';

CREATE TABLE IF NOT EXISTS public.training_video_views (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  training_video_id uuid        NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  kid_id            uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  viewed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_video_views_kid_viewed_idx
  ON public.training_video_views (kid_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS training_video_views_video_idx
  ON public.training_video_views (training_video_id);

ALTER TABLE public.training_videos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_video_views ENABLE ROW LEVEL SECURITY;

-- training_videos RLS --------------------------------------------------------

DROP POLICY IF EXISTS training_videos_select_published ON public.training_videos;
CREATE POLICY training_videos_select_published ON public.training_videos
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
    AND (
      published_at IS NOT NULL
      OR (auth.jwt() ->> 'app_role') = 'admin'
    )
  );

DROP POLICY IF EXISTS training_videos_admin_write_insert ON public.training_videos;
CREATE POLICY training_videos_admin_write_insert ON public.training_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
  );

DROP POLICY IF EXISTS training_videos_admin_write_update ON public.training_videos;
CREATE POLICY training_videos_admin_write_update ON public.training_videos
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
  );

DROP POLICY IF EXISTS training_videos_admin_write_delete ON public.training_videos;
CREATE POLICY training_videos_admin_write_delete ON public.training_videos
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'admin'
    AND tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
  );

-- training_video_views RLS ---------------------------------------------------

-- Parents see views logged for their own kids; admins see all in tenant.
-- INSERT is intentionally NOT covered by a permissive policy — only the
-- SECURITY DEFINER RPC writes here, which bypasses RLS.
DROP POLICY IF EXISTS training_video_views_select_own ON public.training_video_views;
CREATE POLICY training_video_views_select_own ON public.training_video_views
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
    AND (
      (auth.jwt() ->> 'app_role') = 'admin'
      OR kid_id IN (
        SELECT k.id FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
        WHERE f.parent_user_id = auth.uid()
          AND f.tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid)
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_videos      TO authenticated;
GRANT SELECT                          ON public.training_video_views TO authenticated;
GRANT ALL                             ON public.training_videos      TO service_role;
GRANT ALL                             ON public.training_video_views TO service_role;

-- Auto-update updated_at -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_training_videos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_videos_set_updated_at ON public.training_videos;
CREATE TRIGGER training_videos_set_updated_at
  BEFORE UPDATE ON public.training_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_training_videos_set_updated_at();

-- record_training_view RPC ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_training_view(
  p_video_id uuid,
  p_kid_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_kid_tenant  uuid;
  v_caller_role text := (auth.jwt() ->> 'app_role');
  v_caller_tnt  uuid := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT tv.tenant_id INTO v_tenant_id
  FROM public.training_videos tv
  WHERE tv.id = p_video_id
    AND tv.published_at IS NOT NULL;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'training video not found or unpublished' USING ERRCODE = '42704';
  END IF;
  IF v_tenant_id <> v_caller_tnt THEN
    RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501';
  END IF;

  -- Parent: kid must belong to caller's family. Admin: kid must be in tenant.
  SELECT f.tenant_id INTO v_kid_tenant
  FROM public.kids k
  JOIN public.families f ON f.id = k.family_id
  WHERE k.id = p_kid_id
    AND (
      v_caller_role = 'admin'
      OR f.parent_user_id = auth.uid()
    );
  IF v_kid_tenant IS NULL THEN
    RAISE EXCEPTION 'kid not found or not owned by caller' USING ERRCODE = '42501';
  END IF;
  IF v_kid_tenant <> v_caller_tnt THEN
    RAISE EXCEPTION 'cross-tenant access denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.training_video_views (tenant_id, training_video_id, kid_id)
  VALUES (v_tenant_id, p_video_id, p_kid_id);

  UPDATE public.training_videos
     SET view_count = view_count + 1
   WHERE id = p_video_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_training_view(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_training_view(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_training_view(uuid, uuid) IS
  'Idempotent-ish view logger for training_videos (v0.7 task #121). Bumps view_count and inserts a per-kid row. Client throttles via in-memory ref so we get ~1 call per playback session.';
