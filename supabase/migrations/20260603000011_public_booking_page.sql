-- =============================================================================
-- Ballpark — Public booking page: SECURITY DEFINER helpers for anon access
-- =============================================================================
-- Adds two SECURITY DEFINER functions callable by the `anon` role (no JWT):
--
--   get_public_session_types(p_tenant_slug)
--     Returns active session types for a tenant (for filter pills + booking).
--
--   get_public_availability(p_tenant_slug, p_date_range_start, p_date_range_end)
--     Returns coach availability windows expanded to specific dates, with an
--     is_available flag (false when a non-cancelled booking occupies the window
--     for that coach on that day).
--
-- Both functions look up the tenant by slug so no tenant_id is required from
-- the caller — the slug is the public identifier used in the URL.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. get_public_tenant_info  (tenant branding for the booking page header)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_tenant_info(
  p_tenant_slug text
)
RETURNS TABLE (
  id             uuid,
  name           text,
  slug           text,
  brand_colors   jsonb,
  brand_logo_url text
)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.slug, t.brand_colors, t.brand_logo_url
  FROM   public.tenants t
  WHERE  t.slug = p_tenant_slug
  LIMIT  1;
END;
$$;

ALTER FUNCTION public.get_public_tenant_info(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_info(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_info(text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 1. get_public_session_types
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_session_types(
  p_tenant_slug text
)
RETURNS TABLE (
  id               uuid,
  name             text,
  type_category    text,
  duration_minutes int,
  base_price_cents int,
  description      text
)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT t.id INTO v_tenant_id FROM public.tenants t WHERE t.slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    st.id,
    st.name,
    st.type_category,
    st.duration_minutes,
    st.base_price_cents,
    st.description
  FROM public.session_types st
  WHERE st.tenant_id = v_tenant_id
    AND st.is_active  = true
  ORDER BY st.type_category, st.name;
END;
$$;

ALTER FUNCTION public.get_public_session_types(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_public_session_types(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_session_types(text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. get_public_availability
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_availability(
  p_tenant_slug       text,
  p_date_range_start  date,
  p_date_range_end    date
)
RETURNS TABLE (
  coach_id         uuid,
  coach_first_name text,
  coach_last_name  text,
  location_id      uuid,
  location_name    text,
  slot_date        date,
  start_time       time,
  end_time         time,
  is_available     boolean
)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT t.id INTO v_tenant_id FROM public.tenants t WHERE t.slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- Safety: cap range to 30 days to avoid runaway queries
  IF p_date_range_end - p_date_range_start > 30 THEN
    p_date_range_end := p_date_range_start + 30;
  END IF;

  RETURN QUERY
  SELECT
    c.id                  AS coach_id,
    c.first_name          AS coach_first_name,
    c.last_name           AS coach_last_name,
    l.id                  AS location_id,
    l.name                AS location_name,
    d.slot_date::date     AS slot_date,
    ca.start_time,
    ca.end_time,
    NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.tenant_id  = v_tenant_id
        AND b.coach_id   = c.id
        AND b.status     NOT IN ('cancelled', 'no_show')
        AND b.scheduled_start <  (d.slot_date::date + ca.end_time  )::timestamptz
        AND b.scheduled_end   >  (d.slot_date::date + ca.start_time)::timestamptz
    ) AS is_available
  FROM generate_series(
    p_date_range_start::timestamp,
    p_date_range_end::timestamp,
    '1 day'::interval
  ) AS d(slot_date)
  JOIN public.coach_availability ca
    ON  ca.tenant_id   = v_tenant_id
    AND ca.day_of_week = EXTRACT(DOW FROM d.slot_date)::int
    AND (ca.effective_from  IS NULL OR ca.effective_from  <= d.slot_date::date)
    AND (ca.effective_until IS NULL OR ca.effective_until >= d.slot_date::date)
  JOIN public.coaches c
    ON  c.id        = ca.coach_id
    AND c.tenant_id = v_tenant_id
    AND c.is_active = true
  JOIN public.locations l
    ON  l.id        = ca.location_id
    AND l.tenant_id = v_tenant_id
  WHERE d.slot_date::date >= CURRENT_DATE
  ORDER BY d.slot_date, ca.start_time, c.first_name;
END;
$$;

ALTER FUNCTION public.get_public_availability(text, date, date) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_public_availability(text, date, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_availability(text, date, date) TO authenticated;

-- Drop the old overload with old param names if it exists (idempotent rename guard)
-- (CREATE OR REPLACE keeps the same overload; nothing to drop — param names don't
-- affect the function signature in Postgres, so this is purely a readability fix.)
