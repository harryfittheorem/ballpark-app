-- =============================================================================
-- Ballpark — Booking Waitlist (auto-promote on cancellation)
-- =============================================================================
-- 1. Add `capacity` to session_types
-- 2. booking_waitlist table
-- 3. RPCs: join_waitlist, leave_waitlist, claim_waitlist_spot,
--          get_day_slot_availability
-- 4. Cancellation trigger → pg_net → promote-waitlist Edge Function
-- 5. pg_cron: expire stale notified entries + cascade every 15 min
-- =============================================================================


-- ── 1. capacity column on session_types ──────────────────────────────────────

ALTER TABLE public.session_types
  ADD COLUMN IF NOT EXISTS capacity int NOT NULL DEFAULT 1
    CHECK (capacity >= 1);


-- ── 2. booking_waitlist ───────────────────────────────────────────────────────
-- session_slot_key = '{coach_id}_{scheduled_start_iso}'
-- Status flow: waiting → notified → claimed | expired | cancelled

CREATE TABLE public.booking_waitlist (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_slot_key  text        NOT NULL,
  kid_id            uuid        NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  family_id         uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  coach_id          uuid        NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  session_type_id   uuid        NOT NULL REFERENCES public.session_types(id) ON DELETE RESTRICT,
  location_id       uuid        NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  scheduled_start   timestamptz NOT NULL,
  scheduled_end     timestamptz NOT NULL,
  position          int         NOT NULL CHECK (position >= 1),
  status            text        NOT NULL DEFAULT 'waiting'
                                CHECK (status IN ('waiting','notified','claimed','expired','cancelled')),
  notified_at       timestamptz,
  claim_deadline    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bw_tenant_id          ON public.booking_waitlist(tenant_id);
CREATE INDEX idx_bw_session_slot_key   ON public.booking_waitlist(session_slot_key);
CREATE INDEX idx_bw_kid_id             ON public.booking_waitlist(kid_id);
CREATE INDEX idx_bw_family_id          ON public.booking_waitlist(family_id);
CREATE INDEX idx_bw_status             ON public.booking_waitlist(status);
CREATE INDEX idx_bw_claim_deadline     ON public.booking_waitlist(claim_deadline)
  WHERE status = 'notified';

CREATE TRIGGER trg_booking_waitlist_updated_at BEFORE UPDATE ON public.booking_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3a. RLS for booking_waitlist ─────────────────────────────────────────────

ALTER TABLE public.booking_waitlist ENABLE ROW LEVEL SECURITY;

-- Parents: see only their own family's entries
CREATE POLICY bw_select_own_family ON public.booking_waitlist
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND family_id IN (
      SELECT id FROM public.families WHERE parent_user_id = auth.uid()
    )
  );

-- Parents: insert only for their own family (RPC will handle this via SECURITY DEFINER)
-- No direct INSERT policy — all writes go through SECURITY DEFINER RPCs.

-- Admins / coaches can see all (for portal + coach views)
CREATE POLICY bw_select_admin ON public.booking_waitlist
  FOR SELECT TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (
      (auth.jwt() ->> 'app_role') IN ('admin', 'super_admin', 'coach')
    )
  );

GRANT SELECT ON public.booking_waitlist TO authenticated;


-- ── 3b. get_day_slot_availability RPC ────────────────────────────────────────
-- SECURITY DEFINER so it can count bookings across all families (bypasses RLS).
-- Returns (session_slot_key, confirmed_count, waitlist_count, capacity) for a
-- date range within a given session_type. Called once per day by the mobile app.

CREATE OR REPLACE FUNCTION public.get_day_slot_availability(
  p_tenant_id       uuid,
  p_session_type_id uuid,
  p_start           timestamptz,
  p_end             timestamptz
)
RETURNS TABLE(
  session_slot_key  text,
  confirmed_count   bigint,
  waitlist_count    bigint,
  capacity          int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity int;
BEGIN
  SELECT st.capacity INTO v_capacity
  FROM public.session_types st
  WHERE st.id = p_session_type_id AND st.tenant_id = p_tenant_id;

  IF v_capacity IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH confirmed AS (
    SELECT
      b.coach_id::text || '_' || to_char(b.scheduled_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS slot_key,
      COUNT(*) AS cnt
    FROM public.bookings b
    WHERE
      b.tenant_id = p_tenant_id
      AND b.session_type_id = p_session_type_id
      AND b.scheduled_start >= p_start
      AND b.scheduled_start < p_end
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY b.coach_id, b.scheduled_start
  ),
  waitlisted AS (
    SELECT
      w.session_slot_key AS slot_key,
      COUNT(*) AS cnt
    FROM public.booking_waitlist w
    WHERE
      w.tenant_id = p_tenant_id
      AND w.session_type_id = p_session_type_id
      AND w.scheduled_start >= p_start
      AND w.scheduled_start < p_end
      AND w.status IN ('waiting', 'notified')
    GROUP BY w.session_slot_key
  )
  SELECT
    COALESCE(c.slot_key, wl.slot_key) AS session_slot_key,
    COALESCE(c.cnt, 0)                AS confirmed_count,
    COALESCE(wl.cnt, 0)               AS waitlist_count,
    v_capacity                         AS capacity
  FROM confirmed c
  FULL OUTER JOIN waitlisted wl ON wl.slot_key = c.slot_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_day_slot_availability(uuid, uuid, timestamptz, timestamptz)
  TO authenticated;


-- ── 3c. join_waitlist RPC ─────────────────────────────────────────────────────
-- Idempotent: returns existing entry if family already on waitlist for slot.
-- Only allowed for group / cage session types (not private).

CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_session_slot_key  text,
  p_coach_id          uuid,
  p_session_type_id   uuid,
  p_location_id       uuid,
  p_scheduled_start   timestamptz,
  p_scheduled_end     timestamptz
)
RETURNS public.booking_waitlist
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family    public.families;
  v_kid       public.kids;
  v_tenant_id uuid;
  v_st        public.session_types;
  v_next_pos  int;
  v_existing  public.booking_waitlist;
  v_new       public.booking_waitlist;
BEGIN
  -- Resolve caller's family
  SELECT f.* INTO v_family
  FROM public.families f
  WHERE f.parent_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_family' USING ERRCODE = 'P0001';
  END IF;

  -- Resolve first kid (v0.5 single-kid-per-family assumption)
  SELECT k.* INTO v_kid
  FROM public.kids k
  WHERE k.family_id = v_family.id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_kid' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := v_family.tenant_id;

  -- Validate session type belongs to tenant and is group/cage
  SELECT st.* INTO v_st
  FROM public.session_types st
  WHERE st.id = p_session_type_id AND st.tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_type_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_st.type_category = 'private' THEN
    RAISE EXCEPTION 'waitlist_not_available_for_private' USING ERRCODE = 'P0003';
  END IF;

  -- Verify coach, location, session_type all belong to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.coaches WHERE id = p_coach_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'invalid_coach' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.locations WHERE id = p_location_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency: return existing active entry for this family + slot
  SELECT bw.* INTO v_existing
  FROM public.booking_waitlist bw
  WHERE bw.tenant_id = v_tenant_id
    AND bw.session_slot_key = p_session_slot_key
    AND bw.family_id = v_family.id
    AND bw.status IN ('waiting', 'notified');

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Compute next position
  SELECT COALESCE(MAX(bw.position), 0) + 1 INTO v_next_pos
  FROM public.booking_waitlist bw
  WHERE bw.session_slot_key = p_session_slot_key
    AND bw.tenant_id = v_tenant_id
    AND bw.status IN ('waiting', 'notified');

  INSERT INTO public.booking_waitlist (
    tenant_id, session_slot_key, kid_id, family_id, coach_id,
    session_type_id, location_id, scheduled_start, scheduled_end,
    position, status
  ) VALUES (
    v_tenant_id, p_session_slot_key, v_kid.id, v_family.id, p_coach_id,
    p_session_type_id, p_location_id, p_scheduled_start, p_scheduled_end,
    v_next_pos, 'waiting'
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist(text, uuid, uuid, uuid, timestamptz, timestamptz)
  TO authenticated;


-- ── 3d. leave_waitlist RPC ────────────────────────────────────────────────────
-- Sets status='cancelled', re-numbers remaining positions for the slot.

CREATE OR REPLACE FUNCTION public.leave_waitlist(p_waitlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry     public.booking_waitlist;
  v_family_id uuid;
BEGIN
  -- Resolve caller's family
  SELECT f.id INTO v_family_id
  FROM public.families f
  WHERE f.parent_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_family' USING ERRCODE = 'P0001';
  END IF;

  -- Find and lock the entry
  SELECT bw.* INTO v_entry
  FROM public.booking_waitlist bw
  WHERE bw.id = p_waitlist_id
    AND bw.family_id = v_family_id
    AND bw.status IN ('waiting', 'notified')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_yours' USING ERRCODE = 'P0004';
  END IF;

  -- Mark cancelled
  UPDATE public.booking_waitlist
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_waitlist_id;

  -- Re-number remaining active entries for the slot
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY created_at ASC) AS new_pos
    FROM public.booking_waitlist
    WHERE session_slot_key = v_entry.session_slot_key
      AND tenant_id = v_entry.tenant_id
      AND status IN ('waiting', 'notified')
  )
  UPDATE public.booking_waitlist bw
  SET position = r.new_pos, updated_at = now()
  FROM ranked r
  WHERE bw.id = r.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_waitlist(uuid) TO authenticated;


-- ── 3e. claim_waitlist_spot RPC ───────────────────────────────────────────────
-- Validates claim is within deadline; atomically creates booking + marks claimed.
-- Returns CLAIM_EXPIRED if past deadline.

CREATE OR REPLACE FUNCTION public.claim_waitlist_spot(p_waitlist_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry   public.booking_waitlist;
  v_family  public.families;
  v_booking public.bookings;
BEGIN
  -- Resolve caller's family
  SELECT f.* INTO v_family
  FROM public.families f
  WHERE f.parent_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_family' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the waitlist entry
  SELECT bw.* INTO v_entry
  FROM public.booking_waitlist bw
  WHERE bw.id = p_waitlist_id
    AND bw.family_id = v_family.id
    AND bw.status = 'notified'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('code', 'NOT_FOUND');
  END IF;

  -- Check deadline
  IF v_entry.claim_deadline IS NOT NULL AND now() > v_entry.claim_deadline THEN
    UPDATE public.booking_waitlist
    SET status = 'expired', updated_at = now()
    WHERE id = p_waitlist_id;
    RETURN json_build_object('code', 'CLAIM_EXPIRED');
  END IF;

  -- Create the booking atomically
  INSERT INTO public.bookings (
    tenant_id, location_id, kid_id, coach_id, session_type_id,
    scheduled_start, scheduled_end, status
  ) VALUES (
    v_entry.tenant_id, v_entry.location_id, v_entry.kid_id,
    v_entry.coach_id, v_entry.session_type_id,
    v_entry.scheduled_start, v_entry.scheduled_end, 'confirmed'
  )
  RETURNING * INTO v_booking;

  -- Mark entry claimed
  UPDATE public.booking_waitlist
  SET status = 'claimed', updated_at = now()
  WHERE id = p_waitlist_id;

  RETURN json_build_object(
    'code', 'OK',
    'booking_id', v_booking.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_waitlist_spot(uuid) TO authenticated;


-- ── 4. Cancellation trigger → promote-waitlist Edge Function ─────────────────
-- Fires when bookings.status changes TO 'cancelled' or 'no_show'.
-- Uses pg_net to call the promote-waitlist Edge Function asynchronously.

CREATE OR REPLACE FUNCTION public.trg_promote_waitlist_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url       text;
  v_service_role_key   text;
  v_slot_key           text;
BEGIN
  -- Only fire on cancellation transitions
  IF NEW.status NOT IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('cancelled', 'no_show') THEN
    RETURN NEW; -- already cancelled, no re-fire
  END IF;

  v_supabase_url     := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN NEW; -- pg_net not configured; skip silently
  END IF;

  v_slot_key := NEW.coach_id::text || '_' || to_char(NEW.scheduled_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/promote-waitlist',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body    := jsonb_build_object(
      'session_slot_key', v_slot_key,
      'tenant_id',        NEW.tenant_id::text
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bookings_promote_waitlist
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_promote_waitlist_on_cancel();


-- ── 5. pg_cron: expire stale notified entries every 15 min ──────────────────
-- Marks entries past claim_deadline as expired, then fires promote-waitlist
-- for each affected slot so the next person in the queue gets notified.

CREATE OR REPLACE FUNCTION public.expire_stale_waitlist_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url     text;
  v_service_role_key text;
  r                  record;
BEGIN
  v_supabase_url     := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- Expire entries past their claim_deadline
  FOR r IN
    UPDATE public.booking_waitlist
    SET status = 'expired', updated_at = now()
    WHERE status = 'notified'
      AND claim_deadline < now()
    RETURNING session_slot_key, tenant_id
  LOOP
    IF v_supabase_url IS NOT NULL AND v_supabase_url <> '' THEN
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/promote-waitlist',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body    := jsonb_build_object(
          'session_slot_key', r.session_slot_key,
          'tenant_id',        r.tenant_id::text
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Register pg_cron job (tolerates extension not installed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-waitlist-entries',
      '*/15 * * * *',
      'SELECT public.expire_stale_waitlist_entries()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- pg_cron not available in this environment; skip silently
END;
$$;
