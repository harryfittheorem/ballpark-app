-- Set placeholder birthdays and sport_type for all kids missing them.
-- Staggered dates so profiles look realistic during client demo.
-- Only updates rows where the value IS NULL (safe to re-run).

DO $$
DECLARE
  v_tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  rec         record;
  v_offset    int := 0;
  v_birthdays date[] := ARRAY[
    '2012-03-10'::date, '2013-07-22'::date, '2014-01-05'::date,
    '2011-09-18'::date, '2013-11-30'::date, '2012-06-14'::date,
    '2014-04-27'::date, '2011-12-03'::date, '2013-02-08'::date,
    '2012-08-19'::date
  ];
  v_sports    text[] := ARRAY[
    'baseball', 'baseball', 'softball', 'baseball', 'softball',
    'baseball', 'baseball', 'softball', 'baseball', 'softball'
  ];
BEGIN
  FOR rec IN
    SELECT k.id
    FROM public.kids k
    JOIN public.families f ON f.id = k.family_id
    WHERE f.tenant_id = v_tenant_id
      AND (k.birthday IS NULL OR k.sport_type IS NULL)
    ORDER BY k.created_at ASC
  LOOP
    UPDATE public.kids
    SET
      birthday   = CASE WHEN birthday IS NULL
                     THEN v_birthdays[(v_offset % array_length(v_birthdays, 1)) + 1]
                     ELSE birthday END,
      sport_type = CASE WHEN sport_type IS NULL
                     THEN v_sports[(v_offset % array_length(v_sports, 1)) + 1]
                     ELSE sport_type END
    WHERE id = rec.id;
    v_offset := v_offset + 1;
  END LOOP;
  RAISE NOTICE 'Birthdays/sport_type set for % kids', v_offset;
END;
$$;
