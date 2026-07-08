-- Migration: membership_billing_date_changes audit log
-- Records every staff-initiated billing date change (one-time or permanent).

CREATE TABLE IF NOT EXISTS public.membership_billing_date_changes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id       uuid        NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  changed_by_user_id  uuid        NOT NULL,
  old_anchor_day      smallint    NOT NULL CHECK (old_anchor_day BETWEEN 1 AND 28),
  new_anchor_day      smallint    NOT NULL CHECK (new_anchor_day BETWEEN 1 AND 28),
  change_type         text        NOT NULL CHECK (change_type IN ('one_time', 'permanent')),
  effective_date      date        NOT NULL,
  reverted_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_billing_date_changes ENABLE ROW LEVEL SECURITY;

-- Owners/admins may read all changes for memberships in their tenant.
DO $$
BEGIN
  CREATE POLICY "owner_read_billing_date_changes"
    ON public.membership_billing_date_changes
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.id = membership_billing_date_changes.membership_id
          AND m.tenant_id = (
            (current_setting('request.jwt.claims', true))::jsonb ->> 'tenant_id'
          )::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- Service role bypasses RLS (used by webhook + portal API).
-- No explicit policy needed — service_role always bypasses.

COMMENT ON TABLE public.membership_billing_date_changes IS
  'Audit log for staff-initiated recurring billing date changes (one-time or permanent).';

COMMENT ON COLUMN public.membership_billing_date_changes.change_type IS
  'one_time = next invoice only (reverted by stripe-webhook after invoice.payment_succeeded); permanent = all future invoices.';

COMMENT ON COLUMN public.membership_billing_date_changes.reverted_at IS
  'Set by stripe-webhook when a one_time shift is automatically reverted after billing.';
