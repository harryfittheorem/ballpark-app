-- ============================================================
-- Task #244: get_coach_hours RPC
--
-- Aggregates bookings by coach for a given tenant + date range.
-- Returns one row per coach with counts by status and total
-- completed hours (computed from scheduled_start/scheduled_end).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_coach_hours(
  p_tenant_id  uuid,
  p_start_date date,
  p_end_date   date
)
RETURNS TABLE (
  coach_id          uuid,
  coach_name        text,
  confirmed_count   bigint,
  completed_count   bigint,
  no_show_count     bigint,
  cancelled_count   bigint,
  total_hours       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id                                                     AS coach_id,
    (c.first_name || ' ' || c.last_name)                    AS coach_name,
    COUNT(*) FILTER (WHERE b.status = 'confirmed')           AS confirmed_count,
    COUNT(*) FILTER (WHERE b.status = 'completed')           AS completed_count,
    COUNT(*) FILTER (WHERE b.status = 'no_show')             AS no_show_count,
    COUNT(*) FILTER (WHERE b.status = 'cancelled')           AS cancelled_count,
    COALESCE(
      ROUND(
        SUM(
          EXTRACT(EPOCH FROM (b.scheduled_end - b.scheduled_start)) / 3600.0
        ) FILTER (WHERE b.status = 'completed')
      , 2),
      0
    )                                                        AS total_hours
  FROM public.coaches c
  LEFT JOIN public.bookings b
    ON  b.coach_id  = c.id
    AND b.tenant_id = p_tenant_id
    AND b.scheduled_start >= p_start_date::timestamptz
    AND b.scheduled_start <  (p_end_date + 1)::timestamptz
  WHERE c.tenant_id  = p_tenant_id
    AND c.is_active  = true
  GROUP BY c.id, c.first_name, c.last_name
  ORDER BY coach_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_hours(uuid, date, date) TO authenticated;
