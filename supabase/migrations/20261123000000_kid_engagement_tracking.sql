-- Review and referral engagement tracking per player
-- W14: Google review asked/left per kid
-- W15: Referral asked/given per kid

CREATE TABLE public.kid_review_tracking (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id),
  kid_id       uuid NOT NULL REFERENCES public.kids(id),
  review_asked boolean NOT NULL DEFAULT false,
  review_asked_at timestamptz,
  review_left  boolean NOT NULL DEFAULT false,
  review_left_at  timestamptz,
  updated_by   uuid REFERENCES auth.users(id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kid_id)
);

CREATE TABLE public.kid_referral_tracking (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id),
  kid_id          uuid NOT NULL REFERENCES public.kids(id),
  referral_asked  boolean NOT NULL DEFAULT false,
  referral_asked_at timestamptz,
  referral_given  boolean NOT NULL DEFAULT false,
  referral_given_at timestamptz,
  updated_by      uuid REFERENCES auth.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kid_id)
);

ALTER TABLE public.kid_review_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_referral_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_tracking_read ON public.kid_review_tracking
  FOR SELECT TO authenticated USING (true);
CREATE POLICY review_tracking_write ON public.kid_review_tracking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY referral_tracking_read ON public.kid_referral_tracking
  FOR SELECT TO authenticated USING (true);
CREATE POLICY referral_tracking_write ON public.kid_referral_tracking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
