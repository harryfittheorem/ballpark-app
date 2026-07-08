-- =============================================================================
-- Migration: activate_membership_with_scheduled_charge RPC
-- =============================================================================
-- Activates a membership AND inserts a scheduled_charges row in a single
-- transaction, ensuring the two operations are atomic.
-- Used by the kiosk OTC split-payment enrollment path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.activate_membership_with_scheduled_charge(
  p_membership_id uuid,
  p_tenant_id      uuid,
  p_family_id      uuid,
  p_amount_cents   integer,
  p_charge_date    date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Activate the membership
  UPDATE public.memberships
  SET    status     = 'active',
         updated_at = now()
  WHERE  id        = p_membership_id
    AND  tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found or tenant mismatch: %', p_membership_id;
  END IF;

  -- 2. Insert the scheduled balance charge
  INSERT INTO public.scheduled_charges
    (tenant_id, family_id, membership_id, amount_cents, charge_date, status)
  VALUES
    (p_tenant_id, p_family_id, p_membership_id, p_amount_cents, p_charge_date, 'pending');
END;
$$;

-- Grant to service role (portal API routes use service-role client)
GRANT EXECUTE ON FUNCTION public.activate_membership_with_scheduled_charge(
  uuid, uuid, uuid, integer, date
) TO service_role;

-- pg_cron registration (tolerates missing extension / GUCs gracefully)
-- Note: inner dollar-quoting uses $cron$ to avoid collision with outer $$.
DO $$
BEGIN
  PERFORM cron.schedule(
    'collect-scheduled-charges',
    '0 7 * * *',
    $cron$
      SELECT net.http_post(
        url     := current_setting('app.settings.supabase_url', true)
                     || '/functions/v1/collect-scheduled-charges',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body    := '{}'::jsonb
      );
    $cron$
  );
  RAISE NOTICE 'collect-scheduled-charges cron job registered (0 7 * * *)';
EXCEPTION WHEN others THEN
  RAISE NOTICE
    'collect-scheduled-charges cron NOT registered (pg_cron unavailable or GUCs not set): %. '
    'Run: SELECT cron.schedule(...) once pg_cron is enabled.',
    SQLERRM;
END;
$$;
