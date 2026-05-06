-- =============================================================================
-- Ballpark — v0.6 Assignments schema (drills + completion + coach review)
-- =============================================================================
-- Adds the foundation for v0.6 Work:
--   - assignments                          (coach-authored drill per kid)
--   - complete_assignment_for_kid()        SECURITY DEFINER RPC: parent
--                                          self-attestation that credits
--                                          configured points to the kid
--   - review_assignment()                  SECURITY DEFINER RPC: coach
--                                          1-5 rating + feedback
--   - partial unique index on points_ledger guarantees the points credit
--     is idempotent at the database level (no double-credit on retries).
--   - widened RLS on `videos` so parents can read drill videos attached to
--     an assignment for one of their kids.
--
-- Conventions carried from v0.3 / v0.4 / v0.5:
--   - Tenant pin on every write policy (USING + WITH CHECK both reference
--     tenant_id = JWT tenant_id).
--   - App-level role checks read auth.jwt() ->> 'app_role'.
--   - Per-table GRANTs match RLS scope.
--   - Reuses public.set_updated_at().
--   - Cross-tenant FK smuggling defense on every INSERT WITH CHECK clause.
--   - SECURITY DEFINER RPCs re-assert ownership before any mutation.
--
-- Note on points_ledger.reason / reference_type: 'assignment_completed' and
-- 'assignment' are already in the CHECK constraints (see
-- 20260506000000_v05_earn_schema.sql §1) so no constraint changes needed.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Table: assignments
-- -----------------------------------------------------------------------------
-- One row per drill assignment. Coach creates, parent marks submitted,
-- coach reviews. submitted_video_url is reserved for v0.7+ when the kid
-- can upload a return video; v0.6 leaves it NULL.
--
-- family_id is denormalised from kids.family_id so RLS can filter by family
-- without an extra JOIN — same pattern as orders + coach_messages.
CREATE TABLE public.assignments (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kid_id                      uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  family_id                   uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  coach_user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title                       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description                 text,
  drill_video_id              uuid        REFERENCES public.videos(id) ON DELETE SET NULL,
  duration_estimate_minutes   int         CHECK (duration_estimate_minutes IS NULL OR duration_estimate_minutes BETWEEN 1 AND 240),
  due_date                    date,
  point_reward                int         NOT NULL DEFAULT 25 CHECK (point_reward >= 0 AND point_reward <= 1000),
  status                      text        NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'submitted', 'reviewed')),
  submitted_at                timestamptz,
  submitted_video_url         text,
  reviewed_at                 timestamptz,
  rating                      int         CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  feedback                    text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  -- Status invariants: a 'submitted' row must have submitted_at; a
  -- 'reviewed' row must have submitted_at, reviewed_at, AND rating.
  CONSTRAINT assignments_submitted_has_timestamp CHECK (
    status <> 'submitted' OR submitted_at IS NOT NULL
  ),
  CONSTRAINT assignments_reviewed_has_fields CHECK (
    status <> 'reviewed' OR (
      submitted_at IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND rating IS NOT NULL
    )
  )
);


-- -----------------------------------------------------------------------------
-- 2. Indexes on every FK + hot lookup keys
-- -----------------------------------------------------------------------------
CREATE INDEX idx_assignments_tenant_id        ON public.assignments(tenant_id);
CREATE INDEX idx_assignments_kid_id           ON public.assignments(kid_id);
CREATE INDEX idx_assignments_family_id        ON public.assignments(family_id);
CREATE INDEX idx_assignments_coach_user_id    ON public.assignments(coach_user_id);
CREATE INDEX idx_assignments_drill_video_id   ON public.assignments(drill_video_id);
-- Hot lookup for "what does this kid still owe?" + "what does this coach
-- need to review?" queries.
CREATE INDEX idx_assignments_kid_status       ON public.assignments(kid_id, status);
CREATE INDEX idx_assignments_coach_status     ON public.assignments(coach_user_id, status);
CREATE INDEX idx_assignments_due_date         ON public.assignments(due_date);


-- -----------------------------------------------------------------------------
-- 3. updated_at trigger
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_assignments_updated_at BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Idempotency: partial unique index on points_ledger
-- -----------------------------------------------------------------------------
-- Mirrors uniq_points_ledger_booking_completion from v0.5. Guarantees that
-- an assignment can produce at most one 'assignment_completed' ledger row
-- regardless of how many times the RPC is called. The RPC checks status
-- first for a friendly error path; this index is the database-level safety
-- net for races / replays.
CREATE UNIQUE INDEX uniq_points_ledger_assignment_completion
  ON public.points_ledger (reference_id)
  WHERE reason = 'assignment_completed' AND reference_type = 'assignment';


-- -----------------------------------------------------------------------------
-- 5. RLS: enable
-- -----------------------------------------------------------------------------
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 6. RLS policies on assignments
-- -----------------------------------------------------------------------------

-- Parent SELECT: assignments addressed to one of their kids.
CREATE POLICY assignments_select_own_family ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND family_id IN (
      SELECT id FROM public.families WHERE parent_user_id = auth.uid()
    )
  );

-- Coach SELECT: every assignment in their tenant (so the Review tab can
-- list submitted ones across all families).
CREATE POLICY assignments_select_coach ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') = 'coach'
  );

-- Coach INSERT: tenant-pinned, coach_user_id = auth.uid(), kid+family pair
-- must form a real pair belonging to the JWT tenant (cross-tenant FK
-- smuggling defense, same shape as coach_messages_insert_own_coach), and
-- if drill_video_id is supplied it must belong to the same tenant.
CREATE POLICY assignments_insert_own_coach ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND coach_user_id = auth.uid()
    AND (auth.jwt() ->> 'app_role') = 'coach'
    AND EXISTS (
      SELECT 1
        FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
       WHERE k.id = assignments.kid_id
         AND f.id = assignments.family_id
         AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND (
      assignments.drill_video_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.videos v
         WHERE v.id = assignments.drill_video_id
           AND v.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      )
    )
  );

COMMENT ON POLICY assignments_insert_own_coach ON public.assignments IS
$c$Cross-tenant FK smuggling defense (same pattern as
coach_messages_insert_own_coach, see 20260505081000). The kid+family
sub-select verifies the kid belongs to that family AND pins f.tenant_id
to the JWT tenant. The optional drill_video_id sub-select pins the
video's tenant likewise. Do not simplify either EXISTS clause.$c$;

-- No client UPDATE/DELETE on assignments. State transitions
-- (pending -> submitted, submitted -> reviewed) go through the two
-- SECURITY DEFINER RPCs below so we can enforce ownership + atomicity +
-- idempotent points credit.


-- -----------------------------------------------------------------------------
-- 7. RLS: widen videos SELECT for parents to include drill videos attached
--    to their kids' assignments.
-- -----------------------------------------------------------------------------
-- Without this, a parent could see the assignment row but the drill video
-- player would 0-row on RLS. The existing videos_select_recipient_parent
-- policy is anchored on coach_messages and explicitly excludes drafts;
-- this new policy mirrors that shape but anchors on assignments instead.
CREATE POLICY videos_select_assignment_parent ON public.videos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.assignments a
        JOIN public.families f ON f.id = a.family_id
       WHERE a.drill_video_id = videos.id
         AND f.parent_user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 8. GRANTs (RLS narrows rows; GRANTs gate the verb).
--    Privilege model:
--      assignments  authenticated: SELECT, INSERT
--                   (UPDATE goes through RPCs; DELETE not exposed)
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.assignments TO authenticated;


-- -----------------------------------------------------------------------------
-- 9. RPC: complete_assignment_for_kid(p_assignment_id)
-- -----------------------------------------------------------------------------
-- Parent-driven self-attestation. Atomically:
--   1. Validates the caller owns the kid the assignment is for.
--   2. Asserts current status is 'pending' (idempotency soft-check; the
--      partial unique index on points_ledger is the hard floor).
--   3. Flips status to 'submitted', stamps submitted_at = now().
--   4. Increments kids.points_balance by point_reward.
--   5. Inserts the points_ledger row with reason='assignment_completed'
--      and reference_id=assignment_id (idempotent via partial unique
--      index — a duplicate insert raises unique_violation which we map
--      to a friendly already-completed error).
--
-- Returns the new points balance so the caller can update the UI without
-- a refetch.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_assignment_for_kid(
  p_assignment_id uuid
)
RETURNS TABLE (
  assignment_id   uuid,
  new_balance     int,
  points_credited int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_jwt_tenant_id  uuid;
  v_assignment     public.assignments%ROWTYPE;
  v_family         public.families%ROWTYPE;
  v_new_balance    int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: not authenticated' USING ERRCODE = '28000';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;

  -- Lock the assignment row to prevent races between two phones tapping
  -- "Mark complete" simultaneously.
  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: assignment % not found', p_assignment_id USING ERRCODE = 'P0002';
  END IF;

  -- Verify the assignment belongs to the caller's family + tenant.
  SELECT * INTO v_family
    FROM public.families
   WHERE id = v_assignment.family_id;

  IF v_family.parent_user_id <> v_user_id THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: assignment does not belong to caller' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.tenant_id <> v_jwt_tenant_id OR v_family.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  -- Soft idempotency check (friendly error). The partial unique index on
  -- points_ledger is the hard guarantee even if this check races.
  IF v_assignment.status <> 'pending' THEN
    RAISE EXCEPTION 'complete_assignment_for_kid: assignment already %', v_assignment.status USING ERRCODE = 'P0001';
  END IF;

  -- 1) Flip status + stamp submitted_at.
  UPDATE public.assignments
     SET status = 'submitted',
         submitted_at = now()
   WHERE id = v_assignment.id;

  -- 2) Credit points if the reward is non-zero.
  IF v_assignment.point_reward > 0 THEN
    UPDATE public.kids
       SET points_balance = points_balance + v_assignment.point_reward
     WHERE id = v_assignment.kid_id
     RETURNING points_balance INTO v_new_balance;

    -- 3) Insert ledger entry. The partial unique index on
    -- (reference_id) WHERE reason='assignment_completed' AND
    -- reference_type='assignment' guarantees at most one row per
    -- assignment regardless of replays.
    BEGIN
      INSERT INTO public.points_ledger (
        tenant_id, kid_id, delta, reason, reference_type, reference_id, balance_after, note
      ) VALUES (
        v_jwt_tenant_id, v_assignment.kid_id, v_assignment.point_reward,
        'assignment_completed', 'assignment', v_assignment.id, v_new_balance, v_assignment.title
      );
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent caller already credited this assignment. Roll back
      -- the kids.points_balance bump we just did so we don't double-pay.
      RAISE EXCEPTION 'complete_assignment_for_kid: already credited' USING ERRCODE = 'P0001';
    END;
  ELSE
    -- 0-point reward: skip ledger row but still need a balance for the
    -- return value.
    SELECT points_balance INTO v_new_balance FROM public.kids WHERE id = v_assignment.kid_id;
  END IF;

  assignment_id := v_assignment.id;
  new_balance := v_new_balance;
  points_credited := v_assignment.point_reward;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.complete_assignment_for_kid(uuid) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.complete_assignment_for_kid(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.complete_assignment_for_kid(uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 10. RPC: review_assignment(p_assignment_id, p_rating, p_feedback)
-- -----------------------------------------------------------------------------
-- Coach-driven review. Atomically:
--   1. Validates caller is a coach in the assignment's tenant.
--   2. Asserts current status is 'submitted' (can't review a pending or
--      already-reviewed assignment).
--   3. Stamps reviewed_at, rating, feedback; flips status to 'reviewed'.
--
-- Coach is allowed to be ANY coach in the tenant (not just the original
-- creator) — matches the v0.5 product decision that any coach in the
-- tenant can mark a booking complete. Tighten to creator-only later if
-- product wants it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_assignment(
  p_assignment_id uuid,
  p_rating        int,
  p_feedback      text
)
RETURNS public.assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_jwt_tenant_id  uuid;
  v_app_role       text;
  v_assignment     public.assignments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'review_assignment: not authenticated' USING ERRCODE = '28000';
  END IF;

  v_jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  v_app_role      := auth.jwt() ->> 'app_role';

  IF v_jwt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'review_assignment: missing tenant_id claim' USING ERRCODE = '28000';
  END IF;
  IF v_app_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'review_assignment: caller is not a coach' USING ERRCODE = '42501';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'review_assignment: rating must be 1-5' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_assignment: assignment % not found', p_assignment_id USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.tenant_id <> v_jwt_tenant_id THEN
    RAISE EXCEPTION 'review_assignment: tenant mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.status <> 'submitted' THEN
    RAISE EXCEPTION 'review_assignment: assignment is %, must be submitted', v_assignment.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.assignments
     SET status      = 'reviewed',
         reviewed_at = now(),
         rating      = p_rating,
         feedback    = NULLIF(btrim(p_feedback), '')
   WHERE id = v_assignment.id
   RETURNING * INTO v_assignment;

  RETURN v_assignment;
END;
$$;

ALTER FUNCTION public.review_assignment(uuid, int, text) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.review_assignment(uuid, int, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.review_assignment(uuid, int, text) TO authenticated;
