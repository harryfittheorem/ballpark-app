-- R07: separate manual measurements, author-only notes, family game reports
-- and actual-instructor lesson ratings. No imported performance is modified.
BEGIN;

ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS original_hire_date date;
COMMENT ON COLUMN public.coaches.original_hire_date IS 'Verified original employment date; never inferred from account creation.';

CREATE FUNCTION public.can_access_coaching_booking(p_booking uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.kids k ON k.id=b.kid_id
    JOIN public.families f ON f.id=k.family_id AND f.tenant_id=b.tenant_id
    WHERE b.id=p_booking AND public.can_manage_booking_location(b.tenant_id,b.location_id)
    AND (auth.jwt()->>'app_role'<>'coach' OR b.coach_id IS NULL OR EXISTS (
      SELECT 1 FROM public.coaches me WHERE me.user_id=auth.uid() AND me.tenant_id=b.tenant_id
      AND me.is_active AND (me.id=b.coach_id OR me.id=b.actual_coach_id OR me.capabilities->>'preset'='staff')))
  );
$$;
CREATE FUNCTION public.owns_coaching_athlete(p_kid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND auth.jwt()->>'app_role'='parent' AND EXISTS (
    SELECT 1 FROM public.kids k JOIN public.families f ON f.id=k.family_id
    WHERE k.id=p_kid AND f.parent_user_id=auth.uid() AND f.tenant_id=(auth.jwt()->>'tenant_id')::uuid
  );
$$;

CREATE TABLE public.coaching_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kid_id uuid NOT NULL REFERENCES public.kids(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  average_ev numeric NOT NULL CHECK (average_ev>0 AND average_ev<=400),
  peak_ev numeric NOT NULL CHECK (peak_ev>=average_ev AND peak_ev<=400),
  unit text NOT NULL CHECK (unit IN ('mph','km/h')),
  source text NOT NULL DEFAULT 'manual' CHECK (source='manual'),
  replaces_id uuid UNIQUE REFERENCES public.coaching_measurements(id),
  correction_reason text,
  CHECK ((replaces_id IS NULL AND correction_reason IS NULL) OR
    (replaces_id IS NOT NULL AND length(trim(correction_reason)) BETWEEN 1 AND 1000))
);
CREATE TABLE public.private_lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kid_id uuid NOT NULL REFERENCES public.kids(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_on date NOT NULL,
  lesson_number integer NOT NULL CHECK (lesson_number>0),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.self_reported_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kid_id uuid NOT NULL REFERENCES public.kids(id),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  played_on date NOT NULL,
  at_bats integer NOT NULL CHECK (at_bats BETWEEN 0 AND 100),
  singles integer NOT NULL CHECK (singles BETWEEN 0 AND 100),
  doubles integer NOT NULL CHECK (doubles BETWEEN 0 AND 100),
  triples integer NOT NULL CHECK (triples BETWEEN 0 AND 100),
  home_runs integer NOT NULL CHECK (home_runs BETWEEN 0 AND 100),
  hits integer GENERATED ALWAYS AS (singles+doubles+triples+home_runs) STORED,
  strikeouts integer NOT NULL CHECK (strikeouts BETWEEN 0 AND 100),
  walks integer NOT NULL CHECK (walks BETWEEN 0 AND 100),
  rbis integer NOT NULL CHECK (rbis BETWEEN 0 AND 400),
  notes text NOT NULL DEFAULT '' CHECK (length(notes)<=5000),
  source text NOT NULL DEFAULT 'self_reported' CHECK (source='self_reported'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (singles+doubles+triples+home_runs+strikeouts<=at_bats)
);
CREATE TABLE public.lesson_ratings (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kid_id uuid NOT NULL REFERENCES public.kids(id),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  submitted_coach_id uuid NOT NULL REFERENCES public.coaches(id),
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (length(comment)<=3000),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.lesson_ratings.submitted_coach_id IS 'Actual instructor at submission; reports join current audited booking attribution after corrections.';

CREATE TABLE public.coaching_write_receipts (
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  kind text NOT NULL,
  subject uuid NOT NULL,
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE public.coaching_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  record_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.coaching_measurements(booking_id,recorded_on);
CREATE INDEX ON public.private_lesson_notes(recorded_by,booking_id);
CREATE INDEX ON public.self_reported_games(kid_id,played_on);
CREATE INDEX ON public.lesson_ratings(tenant_id,submitted_coach_id);

ALTER TABLE public.coaching_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_reported_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_write_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY measurement_read ON public.coaching_measurements FOR SELECT TO authenticated
  USING (public.can_access_coaching_booking(booking_id));
CREATE POLICY private_note_author_read ON public.private_lesson_notes FOR SELECT TO authenticated
  USING (recorded_by=auth.uid() AND public.can_access_coaching_booking(booking_id));
CREATE POLICY family_game_read ON public.self_reported_games FOR SELECT TO authenticated
  USING (public.owns_coaching_athlete(kid_id) OR EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.kid_id=self_reported_games.kid_id
      AND public.can_access_coaching_booking(b.id)));
CREATE POLICY lesson_rating_read ON public.lesson_ratings FOR SELECT TO authenticated
  USING (public.owns_coaching_athlete(kid_id) OR public.can_access_coaching_booking(booking_id));
REVOKE ALL ON public.coaching_measurements,public.private_lesson_notes,public.self_reported_games,
  public.lesson_ratings,public.coaching_write_receipts,public.coaching_audit FROM anon,authenticated;
GRANT SELECT ON public.coaching_measurements,public.private_lesson_notes,public.self_reported_games,
  public.lesson_ratings TO authenticated;
-- Imports cannot replace a manual result, even using a privileged API client.
REVOKE UPDATE,DELETE ON public.coaching_measurements,public.private_lesson_notes,public.self_reported_games,
  public.lesson_ratings FROM service_role;
CREATE FUNCTION public.coaching_history_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'coaching_history_is_append_only'; END;
$$;
CREATE TRIGGER measurement_history BEFORE UPDATE OR DELETE ON public.coaching_measurements
  FOR EACH ROW EXECUTE FUNCTION public.coaching_history_immutable();
CREATE TRIGGER note_history BEFORE UPDATE OR DELETE ON public.private_lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.coaching_history_immutable();
CREATE TRIGGER game_history BEFORE UPDATE OR DELETE ON public.self_reported_games
  FOR EACH ROW EXECUTE FUNCTION public.coaching_history_immutable();
CREATE TRIGGER rating_history BEFORE UPDATE OR DELETE ON public.lesson_ratings
  FOR EACH ROW EXECUTE FUNCTION public.coaching_history_immutable();
CREATE TRIGGER coaching_audit_history BEFORE UPDATE OR DELETE ON public.coaching_audit
  FOR EACH ROW EXECUTE FUNCTION public.coaching_history_immutable();

CREATE FUNCTION public.save_coaching_record(p_request uuid,p_kind text,p_subject uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  b public.bookings%ROWTYPE; v_tenant uuid; v_result jsonb; receipt public.coaching_write_receipts%ROWTYPE;
  old_measurement public.coaching_measurements%ROWTYPE; v_date date;
BEGIN
  IF auth.uid() IS NULL OR p_request IS NULL OR p_subject IS NULL OR
    p_kind IS NULL OR p_kind NOT IN ('measurement','note','game') OR
    p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'invalid_coaching_request'; END IF;
  -- Authorization is checked on retries too, before any stored response.
  IF p_kind='game' THEN
    IF NOT COALESCE(public.owns_coaching_athlete(p_subject),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    SELECT f.tenant_id INTO v_tenant FROM public.kids k JOIN public.families f ON f.id=k.family_id WHERE k.id=p_subject;
    v_date=(p_data->>'played_on')::date;
  ELSE
    IF NOT COALESCE(public.can_access_coaching_booking(p_subject),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
    SELECT * INTO b FROM public.bookings WHERE id=p_subject FOR SHARE;
    v_tenant=b.tenant_id;
    v_date=(p_data->>'recorded_on')::date;
  END IF;
  IF v_date IS NULL OR v_date>current_date THEN RAISE EXCEPTION 'valid_past_or_current_date_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('coaching:'||auth.uid()::text||':'||p_request::text,0));
  SELECT * INTO receipt FROM public.coaching_write_receipts WHERE actor_id=auth.uid() AND request_id=p_request;
  IF FOUND THEN
    IF receipt.kind<>p_kind OR receipt.subject<>p_subject OR receipt.payload<>p_data THEN RAISE EXCEPTION 'request_id_payload_conflict'; END IF;
    RETURN receipt.result;
  END IF;
  IF p_kind='measurement' THEN
    IF p_data->>'replaces_id' IS NOT NULL THEN
      SELECT * INTO old_measurement FROM public.coaching_measurements WHERE id=(p_data->>'replaces_id')::uuid FOR UPDATE;
      IF NOT FOUND OR old_measurement.booking_id<>b.id THEN RAISE EXCEPTION 'invalid_correction_target'; END IF;
    END IF;
    INSERT INTO public.coaching_measurements(tenant_id,kid_id,location_id,booking_id,recorded_by,recorded_on,
      average_ev,peak_ev,unit,replaces_id,correction_reason)
    VALUES(v_tenant,b.kid_id,b.location_id,b.id,auth.uid(),v_date,(p_data->>'average_ev')::numeric,
      (p_data->>'peak_ev')::numeric,p_data->>'unit',(p_data->>'replaces_id')::uuid,p_data->>'correction_reason')
    RETURNING to_jsonb(coaching_measurements.*) INTO v_result;
  ELSIF p_kind='note' THEN
    INSERT INTO public.private_lesson_notes(tenant_id,kid_id,location_id,booking_id,recorded_by,recorded_on,lesson_number,body)
    VALUES(v_tenant,b.kid_id,b.location_id,b.id,auth.uid(),v_date,(p_data->>'lesson_number')::integer,trim(p_data->>'body'))
    RETURNING to_jsonb(private_lesson_notes.*) INTO v_result;
  ELSE
    INSERT INTO public.self_reported_games(tenant_id,kid_id,recorded_by,played_on,at_bats,singles,doubles,triples,
      home_runs,strikeouts,walks,rbis,notes)
    VALUES(v_tenant,p_subject,auth.uid(),v_date,(p_data->>'at_bats')::integer,(p_data->>'singles')::integer,
      (p_data->>'doubles')::integer,(p_data->>'triples')::integer,(p_data->>'home_runs')::integer,
      (p_data->>'strikeouts')::integer,(p_data->>'walks')::integer,(p_data->>'rbis')::integer,COALESCE(p_data->>'notes',''))
    RETURNING to_jsonb(self_reported_games.*) INTO v_result;
  END IF;
  INSERT INTO public.coaching_write_receipts VALUES(auth.uid(),p_request,p_kind,p_subject,p_data,v_result);
  INSERT INTO public.coaching_audit(tenant_id,actor_id,action,record_id)
    VALUES(v_tenant,auth.uid(),p_kind||'_created',(v_result->>'id')::uuid);
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.rate_coaching_lesson(p_booking uuid,p_score integer,p_comment text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE; r public.lesson_ratings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(public.owns_coaching_athlete(b.kid_id),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF b.status<>'completed' OR b.scheduled_end>now() OR b.actual_coach_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.session_types WHERE id=b.session_type_id AND lower(trim(name))='hitting lesson'
  ) THEN RAISE EXCEPTION 'lesson_not_eligible_for_rating'; END IF;
  IF p_score IS NULL OR p_score NOT BETWEEN 1 AND 5 OR p_comment IS NULL OR length(p_comment)>3000
    THEN RAISE EXCEPTION 'invalid_lesson_rating'; END IF;
  SELECT * INTO r FROM public.lesson_ratings WHERE booking_id=p_booking;
  IF FOUND THEN
    IF r.score<>p_score OR r.comment<>trim(p_comment) THEN RAISE EXCEPTION 'lesson_already_rated_no_edits'; END IF;
    RETURN to_jsonb(r);
  END IF;
  INSERT INTO public.lesson_ratings(booking_id,tenant_id,kid_id,recorded_by,submitted_coach_id,score,comment)
    VALUES(b.id,b.tenant_id,b.kid_id,auth.uid(),b.actual_coach_id,p_score,trim(p_comment)) RETURNING * INTO r;
  INSERT INTO public.coaching_audit(tenant_id,actor_id,action,record_id) VALUES(b.tenant_id,auth.uid(),'lesson_rated',b.id);
  RETURN to_jsonb(r);
END;
$$;

CREATE FUNCTION public.get_staff_coaching_records(p_booking uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
  IF NOT COALESCE(public.can_access_coaching_booking(p_booking),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id=p_booking;
  RETURN jsonb_build_object(
    'measurements',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY recorded_on DESC,created_at DESC) FROM public.coaching_measurements m WHERE booking_id=b.id),'[]'::jsonb),
    'notes',COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY recorded_on DESC,created_at DESC) FROM public.private_lesson_notes n WHERE booking_id=b.id AND recorded_by=auth.uid()),'[]'::jsonb),
    'games',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY played_on DESC,created_at DESC) FROM public.self_reported_games g WHERE kid_id=b.kid_id),'[]'::jsonb));
END;
$$;
CREATE FUNCTION public.get_family_coaching_records(p_kid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT COALESCE(public.owns_coaching_athlete(p_kid),false) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  RETURN jsonb_build_object(
    'games',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY played_on DESC,created_at DESC) FROM public.self_reported_games g WHERE kid_id=p_kid),'[]'::jsonb),
    'lessons',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY scheduled_start DESC) FROM (
      SELECT b.id,b.scheduled_start,b.scheduled_end,b.actual_coach_id,
        concat_ws(' ',c.first_name,c.last_name) AS instructor,st.name AS type_name,
        (SELECT to_jsonb(r) FROM public.lesson_ratings r WHERE r.booking_id=b.id) AS rating
      FROM public.bookings b JOIN public.session_types st ON st.id=b.session_type_id
      JOIN public.coaches c ON c.id=b.actual_coach_id
      WHERE b.kid_id=p_kid AND b.status='completed' AND b.scheduled_end<=now()
        AND b.tenant_id=(auth.jwt()->>'tenant_id')::uuid AND lower(trim(st.name))='hitting lesson'
    ) l),'[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_coaching_booking(uuid),public.owns_coaching_athlete(uuid),
  public.save_coaching_record(uuid,text,uuid,jsonb),public.rate_coaching_lesson(uuid,integer,text),
  public.get_staff_coaching_records(uuid),public.get_family_coaching_records(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_coaching_booking(uuid),public.owns_coaching_athlete(uuid),
  public.save_coaching_record(uuid,text,uuid,jsonb),public.rate_coaching_lesson(uuid,integer,text),
  public.get_staff_coaching_records(uuid),public.get_family_coaching_records(uuid) TO authenticated;
COMMIT;
