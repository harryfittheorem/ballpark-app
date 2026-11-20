-- One transaction, always rolled back. No business data or credentials are changed.
begin;
do $$
declare tenant uuid; actor uuid; course uuid; assignment uuid; batch uuid; draft jsonb; n integer; failed boolean;
begin
  select t.id,u.id into tenant,actor from public.tenants t join auth.users u
    on u.raw_user_meta_data->>'tenant_slug'=t.slug and u.raw_user_meta_data->>'app_role'='owner'
    where t.slug='infinitehitting' limit 1;
  if actor is null then raise exception 'Need an existing owner for rollback-only training assertions'; end if;
  draft:='{"title":"Rollback-only test","description":"","category":"Test","lessons":[{"id":"one","title":"Step","section":"A","kind":"text","body":"Read"}],"questions":[],"passingScore":80,"maxAttempts":3,"acknowledgment":"I agree","audience":["owner"],"reviewDate":null}';
  insert into public.training_courses(tenant_id,draft,created_by) values(tenant,draft,actor) returning id into course;
  perform public.training_mutate(tenant,actor,'publish',course,jsonb_build_object('updated_at',(select updated_at from public.training_courses where id=course)));
  perform public.training_mutate(tenant,actor,'assign',null,jsonb_build_object('courseId',course,'userIds',jsonb_build_array(actor)));
  perform public.training_mutate(tenant,actor,'assign',null,jsonb_build_object('courseId',course,'userIds',jsonb_build_array(actor)));
  select count(*),min(id::text)::uuid into n,assignment from public.training_assignments where course_id=course;
  if n<>1 then raise exception 'Assignment deduplication failed'; end if;
  failed:=false;
  begin perform public.training_mutate(tenant,actor,'complete',assignment,'{"acknowledgedName":"Test"}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Completion bypassed required lesson'; end if;
  perform public.training_mutate(tenant,actor,'progress',assignment,'{"lessonId":"one"}');
  failed:=false;
  begin perform public.training_mutate(tenant,actor,'complete',assignment,'{}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Completion bypassed policy acknowledgment'; end if;
  perform public.training_mutate(tenant,actor,'complete',assignment,'{"acknowledgedName":"Test Learner"}');
  if not exists(select 1 from public.training_assignments where id=assignment and completed_at is not null and acknowledged_at is not null) then raise exception 'Completion was not saved'; end if;
  perform public.training_mutate(tenant,actor,'publish',course,jsonb_build_object('updated_at',(select updated_at from public.training_courses where id=course)));
  if (select version from public.training_assignments where id=assignment)<>1 then raise exception 'Existing assignment version changed'; end if;
  failed:=false;
  begin perform public.training_mutate(tenant,actor,'save',course,jsonb_build_object('draft',draft,'updated_at','2000-01-01T00:00:00Z'));
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Stale draft update accepted'; end if;
  if has_table_privilege('authenticated','public.training_courses','SELECT') then raise exception 'Direct training table access must be denied'; end if;
  if has_function_privilege('authenticated','public.training_mutate(uuid,uuid,text,uuid,jsonb)','EXECUTE') then raise exception 'Client mutation RPC access must be denied'; end if;
  insert into public.training_rules(tenant_id,title,audience,course_id,due_days)
    values(tenant,'Rollback-only rule','owner',course,3);
  perform public.training_apply_rules(tenant,actor);
  perform public.training_apply_rules(tenant,actor);
  if (select count(*) from public.training_assignments where course_id=course and user_id=actor and version=2)<>1 then raise exception 'Automatic enrollment not idempotent'; end if;
  insert into public.training_import_batches(tenant_id,source,checksum,created_by,manifest)
  values(tenant,'rollback-only-test',gen_random_uuid()::text,actor,
    jsonb_build_object('format','ballpark-training-v1','source','rollback-only-test','items',
      jsonb_build_array(jsonb_build_object('sourceId','test-item','title','Test','kind','course','status','ready','course',draft))))
  returning id into batch;
  perform public.training_mutate(tenant,actor,'import',batch);
  if not exists(select 1 from public.training_courses where import_batch_id=batch) then raise exception 'Import failed'; end if;
  perform public.training_mutate(tenant,actor,'rollback',batch);
  if exists(select 1 from public.training_courses where import_batch_id=batch) then raise exception 'Rollback retained imported drafts'; end if;
  if not exists(select 1 from public.training_import_batches where id=batch and status='rolled_back') then raise exception 'Rollback lost batch evidence'; end if;
end $$;
rollback;
