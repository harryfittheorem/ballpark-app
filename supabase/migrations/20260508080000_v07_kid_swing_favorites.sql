-- =============================================================================
-- Ballpark — task #119: kid_swing_favorites + toggle RPC
-- =============================================================================
-- Per-parent "heart" on a swing. UI uses it for the Videos → Favorites
-- sub-tab and for the heart toggle on the Swing Detail screen.
--
-- Why a separate table (instead of `is_favorite` on swings):
--   * swings.tenant_id and swings rows are pre-existing — adding a column
--     that the parent UI mutates would need a swings UPDATE policy, which
--     defeats the "swings are write-only via service role" model.
--   * Future schema supports multiple kids per family — favoriting is per
--     PARENT, but today we scope by kid (one-kid-per-family UI) so the
--     join key is (kid_id, swing_id). We add parent_user_id too so a
--     future "second parent on the family" edit doesn't inherit the other
--     parent's favorites.
--
-- Idempotency: UNIQUE (parent_user_id, swing_id). The toggle RPC inserts
-- on first call and deletes on second; either path returns the new state.
-- =============================================================================

CREATE TABLE public.kid_swing_favorites (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id          uuid        NOT NULL REFERENCES public.kids(id)    ON DELETE CASCADE,
  swing_id        uuid        NOT NULL REFERENCES public.swings(id)  ON DELETE CASCADE,
  parent_user_id  uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kid_swing_favorites_parent_swing_unique
    UNIQUE (parent_user_id, swing_id)
);

CREATE INDEX idx_kid_swing_favorites_tenant_id ON public.kid_swing_favorites(tenant_id);
CREATE INDEX idx_kid_swing_favorites_parent    ON public.kid_swing_favorites(parent_user_id, created_at DESC);
CREATE INDEX idx_kid_swing_favorites_swing     ON public.kid_swing_favorites(swing_id);


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.kid_swing_favorites ENABLE ROW LEVEL SECURITY;

-- Parent can SELECT/INSERT/DELETE only their own rows in their own tenant.
-- The kid_id is verified to belong to the parent's family in the WITH
-- CHECK on INSERT (defence-in-depth — a forged kid_id from another family
-- in the same tenant would still pass tenant_id alone).
CREATE POLICY kid_swing_favorites_select_own ON public.kid_swing_favorites
  FOR SELECT TO authenticated
  USING (
    parent_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY kid_swing_favorites_insert_own ON public.kid_swing_favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    parent_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND kid_id IN (
      SELECT k.id FROM public.kids k
      JOIN public.families f ON f.id = k.family_id
      WHERE f.parent_user_id = auth.uid()
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND swing_id IN (
      SELECT s.id FROM public.swings s
      WHERE s.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        AND s.kid_id IN (
          SELECT k.id FROM public.kids k
          JOIN public.families f ON f.id = k.family_id
          WHERE f.parent_user_id = auth.uid()
            AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    )
  );

CREATE POLICY kid_swing_favorites_delete_own ON public.kid_swing_favorites
  FOR DELETE TO authenticated
  USING (
    parent_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

GRANT SELECT, INSERT, DELETE ON public.kid_swing_favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kid_swing_favorites TO service_role;


-- -----------------------------------------------------------------------------
-- toggle_swing_favorite RPC
-- -----------------------------------------------------------------------------
-- One round-trip toggle. Returns TRUE if the swing is now favorited, FALSE
-- if it was just un-favorited. SECURITY DEFINER so the implementation can
-- bypass RLS for the lookup, but every effect is pinned to auth.uid() and
-- the JWT tenant_id — the caller can only ever toggle their own favorite
-- on a swing that belongs to their family.
CREATE OR REPLACE FUNCTION public.toggle_swing_favorite(p_swing_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_tenant_id  uuid := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  v_kid_id     uuid;
  v_swing_tid  uuid;
  v_existing   uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'toggle_swing_favorite: not authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'toggle_swing_favorite: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  -- Verify the swing belongs to the caller's family + tenant. We resolve
  -- the kid_id from the swing so we don't trust the caller for it.
  SELECT s.kid_id, s.tenant_id INTO v_kid_id, v_swing_tid
  FROM public.swings s
  JOIN public.kids k    ON k.id = s.kid_id
  JOIN public.families f ON f.id = k.family_id
  WHERE s.id = p_swing_id
    AND s.tenant_id = v_tenant_id
    AND f.parent_user_id = v_user_id
    AND f.tenant_id = v_tenant_id;

  IF v_kid_id IS NULL THEN
    RAISE EXCEPTION 'toggle_swing_favorite: swing not found or not visible'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing
  FROM public.kid_swing_favorites
  WHERE parent_user_id = v_user_id AND swing_id = p_swing_id;

  IF v_existing IS NOT NULL THEN
    DELETE FROM public.kid_swing_favorites WHERE id = v_existing;
    RETURN false;
  END IF;

  INSERT INTO public.kid_swing_favorites (tenant_id, kid_id, swing_id, parent_user_id)
  VALUES (v_swing_tid, v_kid_id, p_swing_id, v_user_id)
  ON CONFLICT (parent_user_id, swing_id) DO NOTHING;

  RETURN true;
END;
$$;

ALTER FUNCTION public.toggle_swing_favorite(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.toggle_swing_favorite(uuid) TO authenticated;
