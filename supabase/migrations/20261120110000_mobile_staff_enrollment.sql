-- Server-only request journal: keeps enrollment/payment retries tied to the
-- original family. No parent contact information or signatures are stored here.
CREATE TABLE IF NOT EXISTS public.staff_enrollment_requests (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload_hash text NOT NULL,
  -- Reserve the Auth identity before calling its API. A lost HTTP response can
  -- then be reconciled by ID rather than misclassified as a duplicate account.
  parent_user_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  intent jsonb,
  billing_intent jsonb,
  completed boolean NOT NULL DEFAULT false,
  operation_lock uuid,
  locked_until timestamptz
);
ALTER TABLE public.staff_enrollment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_enrollment_requests FROM anon, authenticated;
GRANT ALL ON public.staff_enrollment_requests TO service_role;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS staff_enrollment_request_id uuid
    UNIQUE REFERENCES public.staff_enrollment_requests(id) ON DELETE SET NULL;

-- Mobile enrollment is not a usable membership until payment/billing succeeds.
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_status_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_status_check
  CHECK (status IN ('active', 'paused', 'cancelled', 'payment_overdue', 'pending_enrollment'));
