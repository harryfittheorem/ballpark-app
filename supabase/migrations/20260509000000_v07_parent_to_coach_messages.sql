-- =============================================================================
-- v0.7 task #120 — bidirectional coach_messages + parent video uploads
-- =============================================================================
-- The same `public.coach_messages` table that v0.4 introduced for coach -> family
-- messaging is widened in this migration to also carry parent -> coach messages
-- (the "Send Video to Coach" composer). The thread UI then renders rows from
-- both directions, ordered by created_at, with sender_user_id deciding the
-- bubble side.
--
-- Changes:
--   1. videos.purpose CHECK constraint: add 'parent_to_coach'.
--   2. coach_messages: add `label` (game_footage | home_practice | swing_check |
--      question | other | NULL) and `sender_display` (free-text "Sent from
--      Mom" attribution typed by the parent in step 4 of the composer).
--   3. New RLS policy `coach_messages_insert_own_parent` mirroring the coach
--      one but inverted: sender is the parent themselves; recipient_kid_id
--      must belong to one of the parent's kids; the attached video (if any)
--      must have purpose='parent_to_coach' and the same tenant. We
--      intentionally do NOT add a separate "select coach inbox" policy:
--      coaches already see every coach_messages row in their tenant via the
--      existing `coach_messages_select_coach_stub` policy
--      (20260505040800_rename_role_to_app_role_in_jwt.sql).
--   4. New RLS policy `coach_messages_select_parent_sender` so the parent
--      can read messages they themselves sent (the existing
--      `coach_messages_select_recipient_parent` only covers inbound).
--   5. New RLS policy `coach_messages_update_coach_recipient` so a coach
--      can mark a parent->coach message viewed (column-level GRANT below
--      already restricts UPDATE to viewed_at).
-- =============================================================================

-- 1. videos.purpose -----------------------------------------------------------
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_purpose_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_purpose_check
  CHECK (purpose IN ('coach_message', 'drill', 'parent_to_coach'));

COMMENT ON COLUMN public.videos.purpose IS
  'What this video was uploaded for. coach_message = sent to a family in the inbox; drill = attached to (or attachable to) an assignments row; parent_to_coach = parent-uploaded video sent to a coach via Send Video to Coach (v0.7 task #120). Set by mux-create-upload from the client''s purpose param; defaults to coach_message for back-compat with rows uploaded before v0.6.';


-- 2. coach_messages columns ---------------------------------------------------
-- recipient_coach_user_id is the explicit coach addressed by a parent->coach
-- row. NULL on coach->parent rows (the coach is the sender there). Required
-- by the INSERT policy + every parent->coach SELECT/UPDATE policy below so
-- threads + inboxes can deterministically attribute a message to one coach
-- (no "lastCoachSeen" guessing in client code).
ALTER TABLE public.coach_messages
  ADD COLUMN IF NOT EXISTS label                   text,
  ADD COLUMN IF NOT EXISTS sender_display          text,
  ADD COLUMN IF NOT EXISTS recipient_coach_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS coach_messages_recipient_coach_user_id_idx
  ON public.coach_messages (recipient_coach_user_id)
  WHERE recipient_coach_user_id IS NOT NULL;

COMMENT ON COLUMN public.coach_messages.recipient_coach_user_id IS
  'Explicit coach addressed by a parent->coach message (v0.7 task #120). NULL on coach->parent rows.';

ALTER TABLE public.coach_messages
  DROP CONSTRAINT IF EXISTS coach_messages_label_check;

ALTER TABLE public.coach_messages
  ADD CONSTRAINT coach_messages_label_check
  CHECK (
    label IS NULL OR label IN (
      'game_footage', 'home_practice', 'swing_check', 'question', 'other'
    )
  );

COMMENT ON COLUMN public.coach_messages.label IS
  'Composer "tag this clip" choice for parent->coach messages. NULL on coach->parent rows.';
COMMENT ON COLUMN public.coach_messages.sender_display IS
  'Composer "sent from" attribution typed by the parent (e.g. "Mom"). NULL on coach->parent rows.';


-- 3. Parent INSERT RLS --------------------------------------------------------
DROP POLICY IF EXISTS coach_messages_insert_own_parent ON public.coach_messages;
CREATE POLICY coach_messages_insert_own_parent ON public.coach_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND sender_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'parent'
    AND EXISTS (
      SELECT 1
        FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
       WHERE k.id = coach_messages.recipient_kid_id
         AND f.id = coach_messages.recipient_family_id
         AND f.parent_user_id = auth.uid()
         AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND coach_messages.recipient_coach_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.coaches c
       WHERE c.user_id = coach_messages.recipient_coach_user_id
         AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND (
      coach_messages.video_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.videos v
         WHERE v.id = coach_messages.video_id
           AND v.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
           AND v.uploaded_by_user_id = auth.uid()
           AND v.purpose = 'parent_to_coach'
      )
    )
  );

COMMENT ON POLICY coach_messages_insert_own_parent ON public.coach_messages IS
  'v0.7 task #120 — parent can INSERT a row addressed to one of their own kids; if a video is attached it must be the parent''s own parent_to_coach upload in the same tenant.';


-- 4. Parent SELECT-own-sent RLS ----------------------------------------------
-- The existing coach_messages_select_recipient_parent only covers inbound
-- (coach -> parent). For the thread view to render the parent's own sent
-- messages we need a second SELECT policy keyed on sender_user_id.
DROP POLICY IF EXISTS coach_messages_select_parent_sender ON public.coach_messages;
CREATE POLICY coach_messages_select_parent_sender ON public.coach_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND sender_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'parent'
  );


-- 4b. Coach SELECT on parent->coach rows addressed to THEM -------------------
-- The pre-existing `coach_messages_select_own_coach` policy only covers rows
-- the coach SENT (`sender_user_id = auth.uid()`). Without this addition a
-- coach would not be able to read parent->coach messages routed to them.
-- Scoped to `recipient_coach_user_id = auth.uid()` so other coaches in the
-- same tenant cannot read messages addressed to a different coach (privacy
-- separation between coaches in the same facility).
DROP POLICY IF EXISTS coach_messages_select_recipient_coach ON public.coach_messages;
CREATE POLICY coach_messages_select_recipient_coach ON public.coach_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND recipient_coach_user_id = auth.uid()
  );


-- 5. Coach UPDATE viewed_at on parent->coach rows ----------------------------
-- Existing coach_messages_update_recipient_parent covers parent marking
-- coach->parent viewed. We add the inverse so the coach can mark a
-- parent->coach message viewed only when THEY are the addressed recipient
-- (recipient_coach_user_id = auth.uid()).
DROP POLICY IF EXISTS coach_messages_update_coach_recipient ON public.coach_messages;
CREATE POLICY coach_messages_update_coach_recipient ON public.coach_messages
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND recipient_coach_user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND recipient_coach_user_id = auth.uid()
  );


-- 6. videos: parent SELECT for own parent_to_coach uploads -------------------
-- The existing videos_select_recipient_parent only matches coach->parent
-- rows (anchored on coach_messages.video_id where the parent is the
-- recipient). When the parent IS the uploader (parent_to_coach) we need a
-- direct uploader-side SELECT so the thread can render the Mux poster.
DROP POLICY IF EXISTS videos_select_own_parent_upload ON public.videos;
CREATE POLICY videos_select_own_parent_upload ON public.videos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND uploaded_by_user_id = auth.uid()
    AND purpose = 'parent_to_coach'
  );


-- 7. videos: parent INSERT for parent_to_coach -------------------------------
-- Existing videos_insert_own_coach is coach-only. Add a parent-side INSERT
-- restricted to purpose='parent_to_coach' so a parent can never smuggle a
-- coach_message / drill row.
DROP POLICY IF EXISTS videos_insert_own_parent_to_coach ON public.videos;
CREATE POLICY videos_insert_own_parent_to_coach ON public.videos
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND uploaded_by_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'parent'
    AND purpose = 'parent_to_coach'
  );

-- 8. videos: coach SELECT on parent_to_coach addressed to them via thread ----
-- A coach must see the Mux poster + playback id of a parent_to_coach video,
-- but ONLY when they are a participant on the message that links to it —
-- either the coach SENT the message (sender_user_id) or the coach is the
-- addressed recipient (recipient_coach_user_id). Without this join scope
-- any coach in the same tenant could read playback ids for parent uploads
-- addressed to a different coach in the same facility, leaking media
-- across coaches. Anchored on the message join, mirroring
-- videos_select_recipient_parent.
DROP POLICY IF EXISTS videos_select_coach_thread ON public.videos;
CREATE POLICY videos_select_coach_thread ON public.videos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND EXISTS (
      SELECT 1 FROM public.coach_messages cm
       WHERE cm.video_id = videos.id
         AND cm.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
         AND (
           cm.sender_user_id = auth.uid()
           OR cm.recipient_coach_user_id = auth.uid()
         )
    )
  );
