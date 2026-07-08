-- Migration: scheduled_charges table for split OTC payment
-- Stores the balance-due portion of a split payment that will be
-- collected automatically by the collect-scheduled-charges Edge Function.

CREATE TABLE IF NOT EXISTS public.scheduled_charges (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  family_id                uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  membership_id            uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  amount_cents             integer NOT NULL CHECK (amount_cents > 0),
  charge_date              date NOT NULL,
  status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'paid', 'failed')),
  stripe_payment_intent_id text,
  failure_reason           text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Index for the cron job query: pending charges due on or before today
CREATE INDEX IF NOT EXISTS idx_scheduled_charges_pending
  ON public.scheduled_charges (status, charge_date)
  WHERE status = 'pending';

-- Index for portal queries by membership
CREATE INDEX IF NOT EXISTS idx_scheduled_charges_membership
  ON public.scheduled_charges (membership_id);

-- Index for portal queries by family
CREATE INDEX IF NOT EXISTS idx_scheduled_charges_family
  ON public.scheduled_charges (family_id);

-- RLS
ALTER TABLE public.scheduled_charges ENABLE ROW LEVEL SECURITY;

-- Owner/admin can read all scheduled charges for their tenant
CREATE POLICY "owner reads scheduled_charges for tenant"
  ON public.scheduled_charges
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
    AND (current_setting('request.jwt.claims', true)::jsonb ->> 'app_role') IN ('owner', 'admin')
  );

-- Parent can read their own scheduled charges
CREATE POLICY "parent reads own scheduled_charges"
  ON public.scheduled_charges
  FOR SELECT
  TO authenticated
  USING (
    family_id IN (
      SELECT id FROM public.families
      WHERE parent_user_id = auth.uid()
    )
  );

-- Service role has full access (for Edge Functions + portal API routes)
-- (service role bypasses RLS by default)

-- Grant table access to authenticated role
GRANT SELECT ON public.scheduled_charges TO authenticated;

-- Register pg_cron job: collect scheduled charges daily at 07:00 UTC
-- Requires pg_cron extension to be enabled in Supabase project.
-- The Edge Function is invoked via pg_net / HTTP call.
-- We store the job registration as a comment; the actual scheduling
-- is done in the Edge Function deployment script.
-- See: supabase/functions/collect-scheduled-charges/index.ts
