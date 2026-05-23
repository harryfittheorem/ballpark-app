-- =============================================================================
-- Ballpark — Task #238: Cancellation Policy Enforcement
-- =============================================================================
-- Adds configurable cancellation-window fields to tenant_config, notice-period
-- columns to memberships, and two SECURITY DEFINER RPCs:
--   • cancel_booking(p_booking_id, p_reason, p_override)
--   • cancel_membership(p_membership_id, p_override)
-- Also registers a daily pg_cron job to auto-cancel memberships whose
-- cancel_effective_at has passed.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. tenant_config — three new policy columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS booking_cancel_window_hours  int  NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS booking_cancel_fee_cents     int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membership_cancel_notice_days int NOT NULL DEFAULT 30;


-- ---------------------------------------------------------------------------
-- 2. memberships — track cancellation request + effective date separately
--    cancel_requested_at: when parent hit "Cancel Membership"
--    cancel_effective_at: computed = MAX(NOW()+notice_days, next_billing_at)
--    (cancel_at already exists from Phase 3; keep it for Stripe end-of-period)
-- ---------------------------------------------------------------------------
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS cancel_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_effective_at  timestamptz;


-- ---------------------------------------------------------------------------
-- 3. Extend points_ledger constraints to accommodate cancellation audit rows
--
-- The existing schema has:
--   • reason CHECK: a closed enum (session_attended, assignment_completed, …)
--   • delta CHECK: delta <> 0
-- We add 'booking_cancelled' to the reason enum and allow delta=0 ONLY for
-- that reason so that cancel_booking can write a zero-delta audit row.
-- ---------------------------------------------------------------------------
ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_reason_check;
ALTER TABLE public.points_ledger
  ADD CONSTRAINT points_ledger_reason_check CHECK (reason IN (
    'session_attended',
    'assignment_completed',
    'pr_hit',
    'redemption',
    'manual_adjustment',
    'achievement_bonus',
    'booking_cancelled'
  ));

-- Relax delta constraint: non-zero for all reasons except booking_cancelled
-- (audit-only rows legitimately carry delta=0).
-- The initial schema creates this as an inline CHECK, so the auto-generated
-- constraint name may vary. We find it dynamically and drop it, then add an
-- explicitly-named replacement.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.points_ledger'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) LIKE '%delta%<>%0%'
  LOOP
    EXECUTE format('ALTER TABLE public.points_ledger DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.points_ledger
  ADD CONSTRAINT points_ledger_delta_nonzero
    CHECK (delta <> 0 OR reason = 'booking_cancelled');


-- ---------------------------------------------------------------------------
-- 4. cancel_booking RPC
--
-- Callable by the parent who owns the booking OR by staff with p_override=true.
-- On a successful cancellation, writes a points_ledger audit row (delta=0,
-- reason='booking_cancelled') for traceability.
--
-- Returns JSON:
--   { ok: true }                                          on success
--   { code: 'LATE_CANCEL', fee_cents: N, window_hours: N } inside window
--   { code: 'NOT_FOUND' }
--   { code: 'ALREADY_CANCELLED' }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_reason     text    DEFAULT NULL,
  p_override   boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking       record;
  v_config        record;
  v_caller_tenant uuid;
  v_caller_role   text;
  v_mins_until    numeric;
  v_window_mins   numeric;
  v_kid_balance   int;
BEGIN
  -- Resolve caller context from JWT
  v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  v_caller_role   := coalesce(auth.jwt() ->> 'app_role', '');

  -- Load booking (tenant-scoped)
  SELECT b.*
    INTO v_booking
    FROM public.bookings b
   WHERE b.id = p_booking_id
     AND b.tenant_id = v_caller_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'NOT_FOUND',
      'message', 'Booking not found or access denied');
  END IF;

  -- Verify parent ownership (bypass for staff roles)
  IF v_caller_role NOT IN ('admin', 'owner', 'coach') THEN
    -- parent: must own the kid on the booking
    IF NOT EXISTS (
      SELECT 1 FROM public.kids k
       WHERE k.id = v_booking.kid_id
         AND k.family_id IN (
           SELECT f.id FROM public.families f
            WHERE f.parent_user_id = auth.uid()
         )
    ) THEN
      RETURN jsonb_build_object('code', 'NOT_FOUND',
        'message', 'Booking not found or access denied');
    END IF;
  END IF;

  -- Already cancelled?
  IF v_booking.status IN ('cancelled', 'no_show') THEN
    RETURN jsonb_build_object('code', 'ALREADY_CANCELLED',
      'message', 'Booking is already cancelled');
  END IF;

  -- Load tenant config (cancellation window + fee)
  SELECT tc.*
    INTO v_config
    FROM public.tenant_config tc
   WHERE tc.tenant_id = v_caller_tenant;

  -- Default values if config row missing
  IF NOT FOUND THEN
    v_config.booking_cancel_window_hours := 24;
    v_config.booking_cancel_fee_cents    := 0;
  END IF;

  -- Check cancellation window (only for non-override calls)
  IF NOT p_override THEN
    v_mins_until  := EXTRACT(EPOCH FROM (v_booking.scheduled_start - now())) / 60.0;
    v_window_mins := v_config.booking_cancel_window_hours * 60.0;

    IF v_mins_until > 0 AND v_mins_until < v_window_mins THEN
      -- Inside the cancellation window → return policy info, do NOT cancel
      RETURN jsonb_build_object(
        'code',         'LATE_CANCEL',
        'fee_cents',    v_config.booking_cancel_fee_cents,
        'window_hours', v_config.booking_cancel_window_hours,
        'message',      format(
          'This booking is within the %s-hour cancellation window.',
          v_config.booking_cancel_window_hours
        )
      );
    END IF;
  END IF;

  -- Perform cancellation
  UPDATE public.bookings
     SET status              = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = p_reason,
         updated_at          = now()
   WHERE id        = p_booking_id
     AND tenant_id = v_caller_tenant;

  -- Audit trail: write a points_ledger row (delta=0) for every cancellation.
  -- If a late-cancel fee is ever applied in points, change delta accordingly.
  IF v_booking.kid_id IS NOT NULL THEN
    SELECT coalesce(k.points_balance, 0)
      INTO v_kid_balance
      FROM public.kids k
     WHERE k.id = v_booking.kid_id;

    INSERT INTO public.points_ledger (
      tenant_id, kid_id, delta, balance_after, reason, reference_id
    ) VALUES (
      v_caller_tenant,
      v_booking.kid_id,
      0,
      coalesce(v_kid_balance, 0),
      'booking_cancelled',
      p_booking_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, text, boolean) TO authenticated;


-- ---------------------------------------------------------------------------
-- 4. cancel_membership RPC
--
-- Parents (app_role='parent') may self-serve cancel their own family's EFT
-- membership via this RPC. Staff (admin/owner) may use p_override=true to
-- re-process an already-requested cancellation.
--
-- SECURITY: ownership check always runs for non-staff callers regardless of
-- p_override. Non-staff callers who pass p_override=true are denied.
--
-- Returns JSON:
--   { ok: true, cancel_effective_at: <ISO> }
--   { code: 'NOT_FOUND' }
--   { code: 'NOT_EFT', message: '...' }
--   { code: 'ALREADY_CANCELLED' }
--   { code: 'ALREADY_REQUESTED', cancel_effective_at: <ISO> }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_membership(
  p_membership_id uuid,
  p_override      boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mem           record;
  v_config        record;
  v_caller_tenant uuid;
  v_caller_role   text;
  v_is_staff      boolean;
  v_notice_days   int;
  v_effective_at  timestamptz;
  v_period_end    timestamptz;
BEGIN
  v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  v_caller_role   := coalesce(auth.jwt() ->> 'app_role', '');
  v_is_staff      := v_caller_role IN ('admin', 'owner');

  -- Load membership (tenant-scoped)
  SELECT m.*
    INTO v_mem
    FROM public.memberships m
   WHERE m.id = p_membership_id
     AND m.tenant_id = v_caller_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'NOT_FOUND',
      'message', 'Membership not found or access denied');
  END IF;

  -- Ownership check: ALWAYS enforced for non-staff callers.
  -- p_override does NOT bypass ownership — it only bypasses the
  -- ALREADY_REQUESTED guard below (staff use case: re-process).
  IF NOT v_is_staff THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.families f
       WHERE f.id = v_mem.family_id
         AND f.parent_user_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object('code', 'NOT_FOUND',
        'message', 'Membership not found or access denied');
    END IF;

    -- Non-staff callers must never use override — reject silently as NOT_FOUND
    -- to avoid leaking policy internals.
    IF p_override THEN
      RETURN jsonb_build_object('code', 'NOT_FOUND',
        'message', 'Membership not found or access denied');
    END IF;
  END IF;

  -- Only EFT memberships support notice-period self-serve cancellation
  IF v_mem.plan_type <> 'eft' THEN
    RETURN jsonb_build_object('code', 'NOT_EFT',
      'message', 'Only recurring (EFT) memberships can be cancelled through the app. '
               || 'Please contact staff to cancel a one-time plan.');
  END IF;

  -- Already fully cancelled?
  IF v_mem.status = 'cancelled' THEN
    RETURN jsonb_build_object('code', 'ALREADY_CANCELLED',
      'message', 'Membership is already cancelled');
  END IF;

  -- Already requested (and not a staff override)?
  IF v_mem.cancel_requested_at IS NOT NULL AND NOT p_override THEN
    RETURN jsonb_build_object('code', 'ALREADY_REQUESTED',
      'cancel_effective_at', to_char(v_mem.cancel_effective_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'message', 'Cancellation already requested');
  END IF;

  -- Load tenant config for notice period
  SELECT tc.membership_cancel_notice_days
    INTO v_notice_days
    FROM public.tenant_config tc
   WHERE tc.tenant_id = v_caller_tenant;

  IF NOT FOUND THEN
    v_notice_days := 30;
  END IF;

  -- Effective date = MAX(now + notice_days, next_billing_at)
  -- next_billing_at is the current period end for EFT subscriptions
  v_period_end := v_mem.next_billing_at;

  v_effective_at := GREATEST(
    now() + (v_notice_days || ' days')::interval,
    coalesce(v_period_end, now() + (v_notice_days || ' days')::interval)
  );

  -- Set cancel_requested_at + cancel_effective_at; do NOT change status yet
  -- (status remains 'active' until auto-cancel cron fires)
  UPDATE public.memberships
     SET cancel_requested_at = now(),
         cancel_effective_at = v_effective_at,
         updated_at          = now()
   WHERE id        = p_membership_id
     AND tenant_id = v_caller_tenant;

  RETURN jsonb_build_object(
    'ok',                 true,
    'cancel_effective_at', to_char(v_effective_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_membership(uuid, boolean) TO authenticated;


-- ---------------------------------------------------------------------------
-- 5. pg_cron: daily job to auto-cancel memberships whose effective date passed
--
-- Requires pg_cron + pg_net extensions. Tolerates their absence (wrapped in
-- a DO block with EXCEPTION). Also requires app.settings.supabase_url and
-- app.settings.service_role_key GUCs — migration is a no-op when absent.
-- Re-running this migration is safe: cron.schedule is idempotent by name.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'process-membership-cancellations',
      '0 2 * * *',
      $cron$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url', true)
                     || '/functions/v1/process-membership-cancellations',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer '
              || current_setting('app.settings.service_role_key', true)
          ),
          body    := '{}'::jsonb
        ) AS request_id
        WHERE current_setting('app.settings.supabase_url', true) IS NOT NULL
          AND current_setting('app.settings.service_role_key', true) IS NOT NULL;
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron or pg_net not available in this environment — skip silently.
  NULL;
END;
$$;


-- =============================================================================
-- VALIDATION QUERIES
-- =============================================================================
-- SELECT booking_cancel_window_hours, booking_cancel_fee_cents,
--        membership_cancel_notice_days
--   FROM public.tenant_config LIMIT 3;
-- Expected: all rows have the three new columns with defaults.
--
-- SELECT cancel_requested_at, cancel_effective_at FROM public.memberships LIMIT 3;
-- Expected: all NULL (no cancellations requested yet).
--
-- SELECT jobname, schedule, command FROM cron.job
--  WHERE jobname = 'process-membership-cancellations';
-- Expected: 1 row when pg_cron is available.
-- =============================================================================
