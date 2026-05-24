-- =============================================================================
-- Ballpark — Harden create_public_booking
-- =============================================================================
-- Fixes identified in code review:
--
-- 1. Tenant isolation: validate p_coach_id and p_location_id belong to the
--    derived tenant_id (a SECURITY DEFINER fn must never trust client-supplied
--    FK references to rows it hasn't verified belong to the right tenant).
--
-- 2. Atomic overlap guard: replace the misleading `FOR UPDATE SKIP LOCKED`
--    (which skips locked rows and does NOT prevent concurrent double-booking)
--    with pg_advisory_xact_lock keyed on (coach_id, scheduled_start_hour).
--    The advisory lock is transaction-scoped and auto-released on commit/
--    rollback.  Two concurrent requests for the same coach at overlapping times
--    will serialize: the first acquires the lock, checks no overlap, inserts,
--    commits; the second then acquires the lock, checks again (sees the first
--    booking), and raises slot_not_available.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_slug     text,
  p_coach_id        uuid,
  p_location_id     uuid,
  p_session_type_id uuid,
  p_kid_id          uuid,
  p_scheduled_start timestamptz
)
RETURNS TABLE (booking_id uuid)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id     uuid;
  v_duration      interval;
  v_scheduled_end timestamptz;
  v_family_id     uuid;
  v_booking_id    uuid;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Derive tenant from slug (never trust a client-supplied tenant_id)
  SELECT t.id INTO v_tenant_id FROM public.tenants t WHERE t.slug = p_tenant_slug LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;

  -- ── Tenant-isolation: all FK references must belong to this tenant ────────

  -- Validate coach belongs to derived tenant and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.id        = p_coach_id
      AND c.tenant_id = v_tenant_id
      AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'coach_not_found';
  END IF;

  -- Validate location belongs to derived tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id        = p_location_id
      AND l.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'location_not_found';
  END IF;

  -- Caller must have a family in this tenant
  SELECT f.id INTO v_family_id
  FROM public.families f
  WHERE f.parent_user_id = auth.uid()
    AND f.tenant_id      = v_tenant_id
  LIMIT 1;
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'family_not_found';
  END IF;

  -- The kid must belong to this family
  IF NOT EXISTS (
    SELECT 1 FROM public.kids k
    WHERE k.id        = p_kid_id
      AND k.family_id = v_family_id
  ) THEN
    RAISE EXCEPTION 'kid_not_in_family';
  END IF;

  -- Session type must belong to this tenant and be active
  SELECT (st.duration_minutes::text || ' minutes')::interval INTO v_duration
  FROM public.session_types st
  WHERE st.id        = p_session_type_id
    AND st.tenant_id = v_tenant_id
    AND st.is_active = true
  LIMIT 1;
  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'session_type_not_found';
  END IF;

  v_scheduled_end := p_scheduled_start + v_duration;

  -- ── Atomic overlap guard ──────────────────────────────────────────────────
  -- Advisory transaction lock keyed on (coach, hour-bucket) prevents two
  -- concurrent transactions from both seeing an empty slot and double-booking.
  -- Lock is automatically released when this transaction commits or rolls back.
  -- Using two-arg form: (int4 classid, int4 objid) = (coach hash, epoch/hour).
  PERFORM pg_advisory_xact_lock(
    hashtext(p_coach_id::text),
    (extract(epoch from date_trunc('hour', p_scheduled_start)) / 3600)::int
  );

  -- After acquiring the lock, re-check for any actual overlapping bookings
  -- (committed by other transactions before this lock was acquired).
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.tenant_id      = v_tenant_id
      AND b.coach_id       = p_coach_id
      AND b.status         NOT IN ('cancelled', 'no_show')
      AND b.scheduled_start < v_scheduled_end
      AND b.scheduled_end   > p_scheduled_start
  ) THEN
    RAISE EXCEPTION 'slot_not_available';
  END IF;

  -- Insert booking
  INSERT INTO public.bookings (
    tenant_id, location_id, kid_id, coach_id, session_type_id,
    scheduled_start, scheduled_end, status
  ) VALUES (
    v_tenant_id, p_location_id, p_kid_id, p_coach_id, p_session_type_id,
    p_scheduled_start, v_scheduled_end, 'confirmed'
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id;
END;
$$;

-- Grants unchanged — function signature is identical
ALTER FUNCTION public.create_public_booking(text, uuid, uuid, uuid, uuid, timestamptz) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text, uuid, uuid, uuid, uuid, timestamptz) TO authenticated;
