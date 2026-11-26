-- NEEDS HARRY'S APPROVAL BEFORE APPLYING.
-- Supabase dev and prod are one project. Do not run this file, db push, or any post-merge script.
-- Marketing reads these objects. This migration does not write crm_threads, payment_events, orders, or Stripe.
-- The views compile against today's columns. Origin and net cash stay null until the CRM and billing
-- owners add the columns in docs/MARKETING_DATA_CONTRACT.md and replace the view bodies in that doc.
-- Until that replacement, mkt_contract_health_v1 stays false and the app shows "unavailable".

BEGIN;

CREATE TABLE public.mkt_acquisition_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid REFERENCES public.locations(id),
  category text NOT NULL CHECK (category IN (
    'media', 'agency_retainer', 'performance_fee', 'production', 'freelance', 'software', 'sales_labor', 'other'
  )),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  cadence text NOT NULL CHECK (cadence IN ('one_time', 'recurring_monthly')),
  service_start date NOT NULL,
  service_end date NOT NULL,
  CHECK (service_end >= service_start),
  channel text CHECK (channel IS NULL OR channel IN ('meta', 'organic', 'referral', 'other')),
  meta_campaign_id text,
  source_ref text,
  notes text,
  entered_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mkt_acquisition_expense_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.mkt_acquisition_expenses(id),
  tenant_id uuid NOT NULL,
  location_id uuid,
  editor uuid,
  edited_at timestamptz NOT NULL DEFAULT now(),
  before jsonb NOT NULL,
  after jsonb NOT NULL
);

CREATE INDEX mkt_acquisition_expenses_location_idx
  ON public.mkt_acquisition_expenses (tenant_id, location_id, service_start, service_end);

CREATE FUNCTION public.mkt_acquisition_expense_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.mkt_acquisition_expense_edits (expense_id, tenant_id, location_id, editor, before, after)
    VALUES (OLD.id, OLD.tenant_id, OLD.location_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_acquisition_expense_audit
  BEFORE UPDATE ON public.mkt_acquisition_expenses
  FOR EACH ROW EXECUTE FUNCTION public.mkt_acquisition_expense_audit();

ALTER TABLE public.mkt_acquisition_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_acquisition_expense_edits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mkt_acquisition_expenses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mkt_acquisition_expense_edits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mkt_acquisition_expenses TO authenticated;
GRANT SELECT ON public.mkt_acquisition_expense_edits TO authenticated;
GRANT ALL ON public.mkt_acquisition_expenses TO service_role;
GRANT ALL ON public.mkt_acquisition_expense_edits TO service_role;

CREATE POLICY mkt_expenses_select ON public.mkt_acquisition_expenses
  FOR SELECT TO authenticated USING (
    (location_id IS NOT NULL AND public.crm_can_access(tenant_id, location_id))
    OR (
      location_id IS NULL
      AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      AND (auth.jwt() ->> 'app_role') = 'owner'
    )
  );

CREATE POLICY mkt_expenses_insert ON public.mkt_acquisition_expenses
  FOR INSERT TO authenticated WITH CHECK (
    (location_id IS NOT NULL AND public.crm_can_access(tenant_id, location_id))
    OR (
      location_id IS NULL
      AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      AND (auth.jwt() ->> 'app_role') = 'owner'
    )
  );

CREATE POLICY mkt_expenses_update ON public.mkt_acquisition_expenses
  FOR UPDATE TO authenticated USING (
    (location_id IS NOT NULL AND public.crm_can_access(tenant_id, location_id))
    OR (
      location_id IS NULL
      AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      AND (auth.jwt() ->> 'app_role') = 'owner'
    )
  ) WITH CHECK (
    (location_id IS NOT NULL AND public.crm_can_access(tenant_id, location_id))
    OR (
      location_id IS NULL
      AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      AND (auth.jwt() ->> 'app_role') = 'owner'
    )
  );

CREATE POLICY mkt_expense_edits_select ON public.mkt_acquisition_expense_edits
  FOR SELECT TO authenticated USING (
    (location_id IS NOT NULL AND public.crm_can_access(tenant_id, location_id))
    OR (
      location_id IS NULL
      AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      AND (auth.jwt() ->> 'app_role') = 'owner'
    )
  );

-- False until the replacement in docs/MARKETING_DATA_CONTRACT.md is installed
-- in the same change that points the views at the new CRM and billing columns.
CREATE FUNCTION public.mkt_contract_health_v1()
RETURNS TABLE (lead_origin_ready boolean, receipts_ready boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT false, false;
$$;

REVOKE ALL ON FUNCTION public.mkt_contract_health_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_contract_health_v1() TO authenticated, service_role;

CREATE VIEW public.mkt_lead_origins_v1
WITH (security_invoker = true) AS
SELECT
  t.tenant_id,
  t.location_id,
  t.id AS lead_id,
  NULL::text AS external_event_id,
  NULL::timestamptz AS created_at,
  loc.timezone AS facility_tz,
  NULL::text AS channel,
  NULL::text AS meta_campaign_id,
  NULL::text AS meta_adset_id,
  NULL::text AS meta_ad_id,
  NULL::text AS meta_form_id,
  NULL::text AS utm_source,
  NULL::text AS utm_medium,
  NULL::text AS utm_campaign,
  NULL::text AS utm_content,
  NULL::text AS utm_term,
  NULL::boolean AS fbclid_present,
  NULL::text AS origin_evidence,
  NULL::text AS origin_confidence,
  NULL::text AS override_reason,
  NULL::uuid AS override_actor,
  NULL::integer AS origin_version,
  CASE
    WHEN t.family_id IS NOT NULL AND t.data ->> 'verified' = 'true' THEN t.family_id
    ELSE NULL
  END AS family_id,
  NULL::timestamptz AS first_paid_at,
  NULL::boolean AS is_reactivation,
  false AS contract_ready
FROM public.crm_threads t
LEFT JOIN public.locations loc ON loc.id = t.location_id AND loc.tenant_id = t.tenant_id;

CREATE VIEW public.mkt_receipts_v1
WITH (security_invoker = true) AS
SELECT *
FROM (
  SELECT DISTINCT ON (COALESCE(p.stripe_invoice_id, p.id::text), p.status)
    p.tenant_id,
    f.primary_location_id AS location_id,
    p.family_id,
    p.id AS receipt_id,
    'stripe'::text AS provider,
    COALESCE(p.stripe_invoice_id, p.stripe_payment_intent_id) AS provider_ref,
    CASE p.status WHEN 'refunded' THEN 'refund' ELSE 'payment' END AS kind,
    'membership'::text AS product_class,
    p.amount_cents AS gross_cents,
    NULL::integer AS tax_cents,
    NULL::integer AS net_cents,
    NULL::text AS currency,
    NULL::timestamptz AS cash_at,
    NULL::timestamptz AS service_start,
    NULL::timestamptz AS service_end,
    NULL::boolean AS is_first_paid,
    'family_primary_location_proxy'::text AS location_basis,
    false AS contract_ready
  FROM public.payment_events p
  LEFT JOIN public.families f ON f.id = p.family_id AND f.tenant_id = p.tenant_id
  WHERE p.status IN ('paid', 'refunded')
  ORDER BY COALESCE(p.stripe_invoice_id, p.id::text), p.status, p.created_at
) payments
UNION ALL
SELECT
  o.tenant_id,
  f.primary_location_id AS location_id,
  o.family_id,
  o.id AS receipt_id,
  'stripe'::text AS provider,
  o.stripe_payment_intent_id AS provider_ref,
  CASE o.status WHEN 'refunded' THEN 'refund' ELSE 'payment' END AS kind,
  'store'::text AS product_class,
  o.amount_paid_cents AS gross_cents,
  NULL::integer AS tax_cents,
  NULL::integer AS net_cents,
  NULL::text AS currency,
  NULL::timestamptz AS cash_at,
  NULL::timestamptz AS service_start,
  NULL::timestamptz AS service_end,
  NULL::boolean AS is_first_paid,
  'family_primary_location_proxy'::text AS location_basis,
  false AS contract_ready
FROM public.orders o
LEFT JOIN public.families f ON f.id = o.family_id AND f.tenant_id = o.tenant_id
WHERE o.payment_method = 'card'
  AND o.status IN ('ordered', 'fulfilled', 'refunded');

REVOKE ALL ON public.mkt_lead_origins_v1 FROM PUBLIC, anon;
REVOKE ALL ON public.mkt_receipts_v1 FROM PUBLIC, anon;
GRANT SELECT ON public.mkt_lead_origins_v1 TO authenticated, service_role;
GRANT SELECT ON public.mkt_receipts_v1 TO authenticated, service_role;

COMMIT;
