-- Demo seed: add completed bookings (lesson history) and set exit_interview_requested
-- on a cancelled membership so testing can demo these features with real data.
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING for bookings.
-- Uses stable prefixed UUIDs in 0000...09xx namespace to avoid collisions.

-- Disable the booking guard trigger so the migration (postgres role, no JWT)
-- can insert completed bookings directly. Re-enabled immediately after.
ALTER TABLE public.bookings DISABLE TRIGGER guard_booking_mutations;

DO $$
DECLARE
  v_tenant_id   uuid := '00000000-0000-0000-0000-000000000001';
  v_location_id uuid := '00000000-0000-0000-0000-000000000101';
  v_coach_id    uuid := '00000000-0000-0000-0000-000000000201';
  v_stype_id    uuid := '00000000-0000-0000-0000-000000000301';
  v_stype2_id   uuid := '00000000-0000-0000-0000-000000000302';
  v_kid1_id     uuid;
  v_mem_id      uuid;
BEGIN

  -- Pick the first kid from this tenant (order by created_at for stability)
  SELECT k.id INTO v_kid1_id
  FROM public.kids k
  JOIN public.families f ON f.id = k.family_id
  WHERE f.tenant_id = v_tenant_id
  ORDER BY k.created_at ASC
  LIMIT 1;

  IF v_kid1_id IS NULL THEN
    RAISE NOTICE 'No kids found for tenant %, skipping lesson history seed', v_tenant_id;
  ELSE
    -- -------------------------------------------------------------------------
    -- Lesson history: 3 completed sessions for kid1
    -- -------------------------------------------------------------------------
    INSERT INTO public.bookings
      (id, tenant_id, location_id, kid_id, coach_id, session_type_id,
       scheduled_start, scheduled_end, status, actual_coach_id, attended_at)
    VALUES
      ('00000000-0000-0000-0000-000000000901',
       v_tenant_id, v_location_id, v_kid1_id, v_coach_id, v_stype_id,
       now() - interval '14 days', now() - interval '14 days' + interval '60 min',
       'completed', v_coach_id, now() - interval '14 days'),
      ('00000000-0000-0000-0000-000000000902',
       v_tenant_id, v_location_id, v_kid1_id, v_coach_id, v_stype2_id,
       now() - interval '7 days', now() - interval '7 days' + interval '60 min',
       'completed', v_coach_id, now() - interval '7 days'),
      ('00000000-0000-0000-0000-000000000903',
       v_tenant_id, v_location_id, v_kid1_id, v_coach_id, v_stype_id,
       now() - interval '2 days', now() - interval '2 days' + interval '60 min',
       'completed', v_coach_id, now() - interval '2 days')
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Lesson history bookings seeded for kid %', v_kid1_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- Exit interview: set flag on a cancelled membership (kid2's family if
  -- they have one; otherwise kid1's family)
  -- -------------------------------------------------------------------------
  SELECT m.id INTO v_mem_id
  FROM public.memberships m
  JOIN public.families f ON f.id = m.family_id
  JOIN public.kids k ON k.family_id = f.id
  WHERE f.tenant_id = v_tenant_id
    AND m.status = 'cancelled'
  ORDER BY m.updated_at DESC
  LIMIT 1;

  IF v_mem_id IS NOT NULL THEN
    UPDATE public.memberships
    SET exit_interview_requested    = true,
        exit_interview_requested_at = now() - interval '1 day'
    WHERE id = v_mem_id;
    RAISE NOTICE 'Exit interview flag set on membership %', v_mem_id;
  ELSE
    RAISE NOTICE 'No cancelled membership found — exit_interview flag not set';
  END IF;

END;
$$;

ALTER TABLE public.bookings ENABLE TRIGGER guard_booking_mutations;
