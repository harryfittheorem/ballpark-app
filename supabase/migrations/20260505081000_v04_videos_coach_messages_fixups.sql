-- =============================================================================
-- Ballpark — v0.4 Step 4.1 fixups
-- =============================================================================
-- Two corrections to 20260505080000_v04_videos_coach_messages.sql, applied
-- as a follow-up because the original was already pushed before review:
--
--   1. coach_messages.video_id ON DELETE CASCADE -> ON DELETE SET NULL.
--      Rationale: a coach (or future GC job) deleting a video should NOT
--      silently destroy the surrounding text-bearing message thread.
--      Note on coach_messages_has_content: PostgreSQL does not re-evaluate
--      row CHECK constraints on FK referential actions (only on INSERT /
--      UPDATE statements that touch the row's data columns), so a SET NULL
--      cascade on a video-only message will leave a row that violates the
--      CHECK without raising an error. That row is stuck until it is either
--      deleted or message_text is added. Acceptable trade vs the bigger
--      win of preserving mixed text+video threads.
--
--   2. Add a COMMENT ON POLICY documenting why the kid-in-family sub-select
--      exists in coach_messages_insert_own_coach. Without this, a future
--      maintainer might "simplify" the policy by dropping the JOIN and
--      reintroduce the cross-tenant FK smuggling vector closed by
--      20260505051000_harden_bookings_fk_tenant_pin.sql.
-- =============================================================================


-- 1. Relax video_id ON DELETE from CASCADE to SET NULL ------------------------
ALTER TABLE public.coach_messages
  DROP CONSTRAINT coach_messages_video_id_fkey;

ALTER TABLE public.coach_messages
  ADD CONSTRAINT coach_messages_video_id_fkey
  FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;


-- 2. Document the cross-tenant FK smuggling defense ---------------------------
COMMENT ON POLICY coach_messages_insert_own_coach ON public.coach_messages IS
$c$Cross-tenant FK smuggling defense (same pattern as
20260505051000_harden_bookings_fk_tenant_pin.sql). The kid+family
sub-select does TWO things at once that BOTH matter:

  (a) Verifies recipient_kid_id and recipient_family_id form a real
      pair — i.e. the kid actually belongs to that family. Without
      this, a coach could attach one family's kid to another family's
      thread.

  (b) Pins f.tenant_id to the JWT tenant. Without this, a coach could
      reference another tenant's family/kid via FK while keeping their
      own tenant_id on the row, breaking tenant isolation.

The second EXISTS clause (on videos) does the same tenant pin for the
optional video_id. DO NOT simplify either EXISTS clause without
preserving both invariants.$c$;
