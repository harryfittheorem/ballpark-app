BEGIN;
CREATE FUNCTION public.get_player_coaching_history(p_kid uuid,p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_total bigint; v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt()->>'app_role','') NOT IN ('owner','admin')
    OR NOT EXISTS (SELECT 1 FROM public.kids k JOIN public.families f ON f.id=k.family_id
      WHERE k.id=p_kid AND f.tenant_id=(auth.jwt()->>'tenant_id')::uuid)
    THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'invalid_history_page'; END IF;
  SELECT count(*) INTO v_total FROM public.bookings b
    WHERE b.kid_id=p_kid AND b.status IN ('completed','no_show','cancelled')
      AND public.can_manage_booking_location(b.tenant_id,b.location_id);
  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY scheduled_start DESC,id),'[]'::jsonb) INTO v_rows FROM (
    SELECT b.id,concat_ws(' ',k.first_name,k.last_name) AS kid_name,b.scheduled_start,b.scheduled_end,
      CASE WHEN c.id IS NULL THEN NULL ELSE concat_ws(' ',c.first_name,c.last_name) END AS actual_coach_name,
      st.name AS type_name,b.status,r.score AS rating
    FROM public.bookings b JOIN public.kids k ON k.id=b.kid_id
    JOIN public.session_types st ON st.id=b.session_type_id
    LEFT JOIN public.coaches c ON c.id=b.actual_coach_id LEFT JOIN public.lesson_ratings r ON r.booking_id=b.id
    WHERE b.kid_id=p_kid AND b.status IN ('completed','no_show','cancelled')
      AND public.can_manage_booking_location(b.tenant_id,b.location_id)
    ORDER BY b.scheduled_start DESC,b.id LIMIT 50 OFFSET (p_page-1)*50
  ) l;
  RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.get_player_coaching_history(uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_player_coaching_history(uuid,integer) TO authenticated;
COMMIT;
