-- Staff access configuration per tenant (W17)
-- Stores which optional nav sections each preset can access as a JSONB blob.
-- Keys: preset names ('instructor', 'staff'). Values: arrays of enabled section keys.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS staff_access_config jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.staff_access_config IS
  'UI-layer nav visibility overrides per staff preset. {"instructor": ["schedule", "checkin", ...], "staff": [...]}';
