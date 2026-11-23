-- Owner notifications for automated alerts (A5: revenue decline intervention)
-- Stores per-tenant notifications shown on the dashboard and Today page.

CREATE TABLE IF NOT EXISTS public.owner_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('revenue_decline', 'at_risk_spike', 'eval_reminder', 'anniversary')),
  title           text NOT NULL,
  body            text NOT NULL,
  cta_label       text,
  cta_href        text,
  severity        text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  dismissed       boolean NOT NULL DEFAULT false,
  dismissed_at    timestamptz,
  dismissed_by    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

CREATE INDEX IF NOT EXISTS owner_notifications_tenant_active
  ON public.owner_notifications (tenant_id, dismissed, created_at DESC);

COMMENT ON TABLE public.owner_notifications IS
  'Automated per-tenant notifications. Revenue decline (A5) alerts are inserted by the check-revenue-decline edge function.';
