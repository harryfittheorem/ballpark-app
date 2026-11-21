-- Development-only assertions; every fixture is rolled back.
begin;
do $$
declare tenant uuid; other_tenant uuid; actor uuid; batch uuid; course uuid; draft jsonb; failed boolean; result jsonb;
begin
  select id into tenant from public.tenants where slug='infinitehitting';
  select id into other_tenant from public.tenants where slug='test-tenant-two';
  select id into actor from auth.users where email='demo.owner.review@ballpark.test';
  if tenant is null or other_tenant is null or actor is null then raise exception 'Required development fixtures unavailable'; end if;
  draft:='{"title":"Import guard fixture","description":"","category":"Test","lessons":[{"id":"one","title":"Step","section":"A","kind":"text","body":"Read","references":[{"url":"https://www.youtube.com/watch?v=Q2QmuDLUTR4","kind":"video","label":"Original","status":"linked"},{"url":"https://www.youtube.com/watch?v=Q2QmuDLUTR4","kind":"video","label":"Repeated","status":"linked"}]}],"questions":[],"passingScore":80,"maxAttempts":3,"acknowledgment":"","audience":["owner"],"reviewDate":null}';
  insert into public.training_import_batches(tenant_id,source,checksum,created_by,manifest)
  values(tenant,'guard-fixture',gen_random_uuid()::text,actor,jsonb_build_object('format','ballpark-training-v1','source','guard-fixture','items',
    jsonb_build_array(jsonb_build_object('sourceId','one','title','Fixture','kind','course','status','ready','course',draft))))
  returning id into batch;
  failed:=false;
  begin perform public.training_mutate(other_tenant,actor,'import',batch);
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Cross-tenant import accepted'; end if;
  perform public.training_mutate(tenant,actor,'import',batch);
  result:=public.training_mutate(tenant,actor,'import',batch);
  if (result->>'count')::integer<>0 then raise exception 'Repeat import created duplicates'; end if;
  select id into course from training_courses where import_batch_id=batch;
  if (select jsonb_array_length(c.draft->'lessons'->0->'references') from training_courses c where c.id=course)<>2 then raise exception 'Repeated video association lost'; end if;
  if exists(select 1 from training_assignments where course_id=course) then raise exception 'Import enrolled learners'; end if;
  -- Exercise edited-course rollback guard independent of transaction timestamp.
  update training_courses set updated_at=now()+interval '1 second' where id=course;
  failed:=false;
  begin perform public.training_mutate(tenant,actor,'rollback',batch);
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Edited draft rollback accepted'; end if;
  update training_courses set updated_at=now() where id=course;
  perform public.training_mutate(tenant,actor,'publish',course,jsonb_build_object('updated_at',(select updated_at from training_courses where id=course)));
  failed:=false;
  begin perform public.training_mutate(tenant,actor,'rollback',batch);
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Published course rollback accepted'; end if;
  if not exists(select 1 from training_courses where id=course) then raise exception 'Rollback deleted protected course'; end if;
end $$;
rollback;
