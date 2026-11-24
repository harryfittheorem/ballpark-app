-- Demo seed for client walkthrough: covers Today anniversaries, Points & Rewards
-- (top earners, HitTrax leaderboard, rewards catalog), Cancellations (exit reason +
-- competitor), owner notification (revenue decline banner), and kid birthday.
--
-- Idempotent: ON CONFLICT DO NOTHING on inserts; UPDATE on update targets.
-- Stable UUIDs in 00000000-0000-0000-0000-0000000Axx namespace.

DO $$
DECLARE
  v_tenant_id   uuid := '00000000-0000-0000-0000-000000000001';
  v_kid1_id     uuid;
  v_kid2_id     uuid;
  v_kid3_id     uuid;
  v_mem1_id     uuid;  -- first active membership  → anniversary tweak
  v_mem_cancel  uuid;  -- most recent cancelled membership → exit reason
BEGIN

  -- -------------------------------------------------------------------------
  -- Resolve first 3 kids in the tenant
  -- -------------------------------------------------------------------------
  SELECT k.id INTO v_kid1_id
  FROM public.kids k JOIN public.families f ON f.id = k.family_id
  WHERE f.tenant_id = v_tenant_id ORDER BY k.created_at ASC LIMIT 1;

  SELECT k.id INTO v_kid2_id
  FROM public.kids k JOIN public.families f ON f.id = k.family_id
  WHERE f.tenant_id = v_tenant_id ORDER BY k.created_at ASC OFFSET 1 LIMIT 1;

  SELECT k.id INTO v_kid3_id
  FROM public.kids k JOIN public.families f ON f.id = k.family_id
  WHERE f.tenant_id = v_tenant_id ORDER BY k.created_at ASC OFFSET 2 LIMIT 1;

  IF v_kid2_id IS NULL THEN v_kid2_id := v_kid1_id; END IF;
  IF v_kid3_id IS NULL THEN v_kid3_id := v_kid2_id; END IF;

  -- -------------------------------------------------------------------------
  -- Today page: member anniversary
  -- Set an active membership's started_at to 2 years ago this week so the
  -- anniversary countdown (≤7 days) fires for the Today page.
  -- -------------------------------------------------------------------------
  SELECT m.id INTO v_mem1_id
  FROM public.memberships m JOIN public.families f ON f.id = m.family_id
  WHERE f.tenant_id = v_tenant_id AND m.status IN ('active','at-risk')
  ORDER BY m.created_at ASC LIMIT 1;

  IF v_mem1_id IS NOT NULL THEN
    -- anniversary lands Nov 26, 2026 (2 days from today 2026-11-24)
    UPDATE public.memberships
    SET started_at = '2024-11-26'
    WHERE id = v_mem1_id AND started_at IS NULL;
    -- only write if it was NULL so we don't overwrite real data
    RAISE NOTICE 'Anniversary seed: membership %', v_mem1_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- Kid birthday (shows on member profile header)
  -- -------------------------------------------------------------------------
  IF v_kid1_id IS NOT NULL THEN
    UPDATE public.kids
    SET birthday = '2013-04-15'
    WHERE id = v_kid1_id AND birthday IS NULL;
  END IF;

  -- -------------------------------------------------------------------------
  -- Points & Rewards — top earners: points_ledger entries
  -- -------------------------------------------------------------------------
  IF v_kid1_id IS NOT NULL THEN
    INSERT INTO public.points_ledger
      (id, tenant_id, kid_id, delta, reason, reference_type, balance_after, note)
    VALUES
      ('00000000-0000-0000-0000-0000000a0101',
       v_tenant_id, v_kid1_id, 50, 'session_attended', 'booking', 50,
       'Session 1 attendance'),
      ('00000000-0000-0000-0000-0000000a0102',
       v_tenant_id, v_kid1_id, 50, 'session_attended', 'booking', 100,
       'Session 2 attendance'),
      ('00000000-0000-0000-0000-0000000a0103',
       v_tenant_id, v_kid1_id, 100, 'pr_hit', 'swing', 200,
       'Exit velo PR'),
      ('00000000-0000-0000-0000-0000000a0201',
       v_tenant_id, v_kid2_id, 50, 'session_attended', 'booking', 50,
       'Session attendance'),
      ('00000000-0000-0000-0000-0000000a0202',
       v_tenant_id, v_kid2_id, 75, 'pr_hit', 'swing', 125,
       'Distance PR'),
      ('00000000-0000-0000-0000-0000000a0301',
       v_tenant_id, v_kid3_id, 50, 'session_attended', 'booking', 50,
       'Session attendance')
    ON CONFLICT (id) DO NOTHING;

    -- Sync kids.points_balance with their ledger totals (approximate)
    UPDATE public.kids SET points_balance = 200 WHERE id = v_kid1_id AND points_balance = 0;
    UPDATE public.kids SET points_balance = 125 WHERE id = v_kid2_id AND points_balance = 0;
    UPDATE public.kids SET points_balance = 50  WHERE id = v_kid3_id AND points_balance = 0;

    RAISE NOTICE 'Points ledger seeded';
  END IF;

  -- -------------------------------------------------------------------------
  -- Points & Rewards — HitTrax leaderboard: sessions with exit velocity
  -- -------------------------------------------------------------------------
  IF v_kid1_id IS NOT NULL THEN
    INSERT INTO public.sessions
      (id, tenant_id, kid_id, capture_source, started_at,
       swing_count, best_exit_velocity_mph, avg_exit_velocity_mph, max_distance_ft)
    VALUES
      ('00000000-0000-0000-0000-0000000b0101',
       v_tenant_id, v_kid1_id, 'hittrax',
       now() - interval '10 days', 45, 94.2, 87.5, 385),
      ('00000000-0000-0000-0000-0000000b0201',
       v_tenant_id, v_kid2_id, 'hittrax',
       now() - interval '8 days',  38, 89.7, 83.1, 352),
      ('00000000-0000-0000-0000-0000000b0301',
       v_tenant_id, v_kid3_id, 'hittrax',
       now() - interval '5 days',  52, 86.4, 79.8, 341)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'HitTrax sessions seeded';
  END IF;

  -- -------------------------------------------------------------------------
  -- Cancellations — set exit reason + competitor on most recent cancellation
  -- -------------------------------------------------------------------------
  SELECT m.id INTO v_mem_cancel
  FROM public.memberships m JOIN public.families f ON f.id = m.family_id
  WHERE f.tenant_id = v_tenant_id AND m.status = 'cancelled'
  ORDER BY m.updated_at DESC LIMIT 1;

  IF v_mem_cancel IS NOT NULL THEN
    UPDATE public.memberships
    SET cancellation_reason = 'Competitor',
        competitor_name     = 'Extra Innings Baseball'
    WHERE id = v_mem_cancel
      AND cancellation_reason IS NULL;
    RAISE NOTICE 'Cancellation exit reason seeded on membership %', v_mem_cancel;
  END IF;

END;
$$;

-- -------------------------------------------------------------------------
-- Points & Rewards — rewards catalog (products)
-- -------------------------------------------------------------------------
INSERT INTO public.products
  (id, tenant_id, name, description, category, points_cost,
   is_redeemable, is_purchasable, is_active, sort_order)
VALUES
  ('00000000-0000-0000-0000-0000000c0101',
   '00000000-0000-0000-0000-000000000001',
   'IH Performance Hoodie', 'Infinite Hitting branded hoodie',
   'apparel', 500, true, false, true, 1),
  ('00000000-0000-0000-0000-0000000c0102',
   '00000000-0000-0000-0000-000000000001',
   'Free Private Lesson', '30-min 1-on-1 with a coach',
   'sessions', 1000, true, false, true, 2),
  ('00000000-0000-0000-0000-0000000c0103',
   '00000000-0000-0000-0000-000000000001',
   'IH Snapback Hat', 'Infinite Hitting snapback',
   'gear', 250, true, false, true, 3)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- Dashboard — owner notification (revenue decline banner)
-- -------------------------------------------------------------------------
INSERT INTO public.owner_notifications
  (id, tenant_id, kind, title, body, cta_label, cta_href, severity, dismissed)
VALUES
  ('00000000-0000-0000-0000-0000000d0101',
   '00000000-0000-0000-0000-000000000001',
   'revenue_decline',
   'Revenue down 12% vs last month',
   '3 members cancelled and 2 are at risk of churning. Consider a re-engagement campaign.',
   'View At-Risk Members', '/owner/at-risk',
   'warning', false)
ON CONFLICT (id) DO NOTHING;
