BEGIN;
-- A single lesson projection drives both drilldowns and denominators. Unknown
-- actual instructors remain unknown, including legacy and no-show records.
CREATE FUNCTION public.get_coaching_report(p_start date,p_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_end-p_start>3660 THEN RAISE EXCEPTION 'invalid_report_range'; END IF;
  RETURN COALESCE((WITH lesson AS (
    SELECT b.id,b.actual_coach_id,b.scheduled_start,b.scheduled_end,b.status,
      concat_ws(' ',k.first_name,k.last_name) AS kid_name,
      CASE WHEN c.id IS NULL THEN NULL ELSE concat_ws(' ',c.first_name,c.last_name) END AS actual_coach_name,
      st.name AS type_name,r.score AS rating,
      b.status='completed' AND b.scheduled_end<=now() AND b.actual_coach_id IS NOT NULL
        AND lower(trim(st.name))='hitting lesson' AS eligible
    FROM public.bookings b JOIN public.session_types st ON st.id=b.session_type_id
    LEFT JOIN public.kids k ON k.id=b.kid_id LEFT JOIN public.coaches c ON c.id=b.actual_coach_id
    LEFT JOIN public.lesson_ratings r ON r.booking_id=b.id
    WHERE b.status IN ('completed','no_show','cancelled') AND st.type_category<>'cage'
      AND b.kid_id IS NOT NULL AND public.can_manage_booking_location(b.tenant_id,b.location_id)
      AND (b.scheduled_start AT TIME ZONE COALESCE((SELECT timezone FROM public.locations WHERE id=b.location_id),'UTC'))::date BETWEEN p_start AND p_end
  ), groups AS (
    SELECT actual_coach_id,
      count(*) FILTER (WHERE status='completed') AS completed_count,
      count(*) FILTER (WHERE status='no_show') AS no_show_count,
      count(*) FILTER (WHERE status='cancelled') AS cancelled_count,
      COALESCE(sum(EXTRACT(EPOCH FROM scheduled_end-scheduled_start)/3600) FILTER (WHERE status='completed'),0) AS total_hours,
      avg(rating) FILTER (WHERE eligible) AS avg_rating,
      count(rating) FILTER (WHERE eligible) AS rated_count,
      count(*) FILTER (WHERE eligible) AS eligible_count,
      jsonb_agg(jsonb_build_object('id',id,'kid_name',kid_name,'scheduled_start',scheduled_start,
        'scheduled_end',scheduled_end,'actual_coach_name',actual_coach_name,'type_name',type_name,'status',status,'rating',rating)
        ORDER BY scheduled_start DESC,id) AS lessons
    FROM lesson GROUP BY actual_coach_id
  )
  SELECT jsonb_agg(to_jsonb(report) ORDER BY coach_name) FROM (
    SELECT COALESCE(g.actual_coach_id::text,'unattributed') AS coach_id,
      CASE WHEN c.id IS NULL THEN 'Actual instructor not recorded' ELSE concat_ws(' ',c.first_name,c.last_name) END AS coach_name,
      g.completed_count,g.no_show_count,g.cancelled_count,g.total_hours,g.avg_rating,g.rated_count,g.eligible_count,
      c.original_hire_date,(c.original_hire_date+interval '1 year')::date AS first_anniversary,g.lessons
    FROM groups g LEFT JOIN public.coaches c ON c.id=g.actual_coach_id
  ) report),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_coaching_report(date,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_coaching_report(date,date) TO authenticated;
COMMIT;
