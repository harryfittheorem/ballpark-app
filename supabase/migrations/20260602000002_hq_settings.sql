-- =============================================================================
-- Ballpark — HQ Network Settings: extend tenant_config
-- =============================================================================
-- Adds three optional columns to the existing `tenant_config` table:
--   royalty_rate_override — per-tenant rate override (null = use tenants.royalty_config default)
--   network_logo_url      — global network logo URL (written on the primary tenant's row)
--   network_favicon_url   — global network favicon URL (written on the primary tenant's row)
--
-- Super admins manage these via /hq/settings. Royalty rate overrides take
-- precedence over tenants.royalty_config.rate when calculating HQ revenue.
-- =============================================================================

ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS royalty_rate_override  NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS network_logo_url       TEXT,
  ADD COLUMN IF NOT EXISTS network_favicon_url    TEXT;

COMMENT ON COLUMN public.tenant_config.royalty_rate_override IS
  'Per-tenant royalty rate override (0–1). NULL means use tenants.royalty_config.rate.';

COMMENT ON COLUMN public.tenant_config.network_logo_url IS
  'Global HQ network logo URL. Only meaningful on the primary (HQ) tenant row.';

COMMENT ON COLUMN public.tenant_config.network_favicon_url IS
  'Global HQ network favicon URL. Only meaningful on the primary (HQ) tenant row.';
