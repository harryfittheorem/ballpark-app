-- Additive training module. Direct API access is deliberately denied: all operations
-- go through the portal's verified, tenant-scoped server authorization boundary.
begin;

create table public.training_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  source text not null,
  checksum text not null,
  manifest jsonb not null,
  status text not null default 'staged' check (status in ('staged','imported','rolled_back')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  rolled_back_at timestamptz,
  unique (tenant_id, checksum)
);
create table public.training_courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  draft jsonb not null,
  published_version integer,
  archived boolean not null default false,
  editors uuid[] not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  import_batch_id uuid references public.training_import_batches(id),
  source_id text
);
create unique index training_source_unique on public.training_courses(tenant_id,source_id) where source_id is not null;
create index training_courses_tenant on public.training_courses(tenant_id);
create table public.training_revisions (
  course_id uuid not null references public.training_courses(id),
  version integer not null check(version > 0),
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references auth.users(id),
  primary key (course_id,version)
);
create table public.training_paths (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  title text not null,
  description text not null default '',
  course_ids uuid[] not null,
  created_at timestamptz not null default now()
);
create table public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  course_id uuid not null,
  version integer not null,
  user_id uuid not null references auth.users(id),
  assigned_by uuid not null references auth.users(id),
  due_at timestamptz,
  completed_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_name text,
  source text not null default 'app',
  path_id uuid references public.training_paths(id),
  prerequisite_ids uuid[] not null default '{}',
  cycle integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key(course_id,version) references public.training_revisions(course_id,version),
  unique(course_id,version,user_id,cycle)
);
create index training_assignments_tenant_user on public.training_assignments(tenant_id,user_id);
create table public.training_progress (
  assignment_id uuid not null references public.training_assignments(id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  signed_off_by uuid references auth.users(id),
  primary key(assignment_id,lesson_id)
);
create table public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.training_assignments(id) on delete cascade,
  score integer not null check(score between 0 and 100),
  passed boolean not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create table public.training_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  uploaded_by uuid not null references auth.users(id),
  filename text not null,
  mime text not null,
  size bigint not null,
  path text not null unique,
  checksum text,
  status text not null default 'pending' check(status in ('pending','ready')),
  created_at timestamptz not null default now()
);
create table public.training_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  batch_id uuid not null references public.training_import_batches(id),
  source_id text not null,
  record jsonb not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,source_id)
);
create table public.training_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.training_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  title text not null,
  audience text not null check(audience in ('owner','admin','coach','staff')),
  course_id uuid references public.training_courses(id),
  path_id uuid references public.training_paths(id),
  due_days integer not null default 7 check(due_days between 1 and 365),
  repeat_days integer check(repeat_days between 1 and 730),
  enabled boolean not null default true,
  starts_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((course_id is null) <> (path_id is null))
);

do $$ declare t text; begin
  foreach t in array array['training_import_batches','training_courses','training_revisions','training_paths',
    'training_assignments','training_progress','training_attempts','training_assets','training_history','training_audit','training_rules']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

-- All mutations below are atomic, serialized per course/enrollment/batch, and service-only.
create function public.training_mutate(p_tenant uuid,p_actor uuid,p_action text,p_id uuid,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  c training_courses; a training_assignments; b training_import_batches;
  v integer; n integer := 0; r jsonb; item jsonb; cid uuid; uid uuid; aid uuid;
  course_ids uuid[]; prereqs uuid[]; path uuid; ids uuid[];
begin
  if p_action in ('save','publish','archive','restore','editors') then
    select * into c from training_courses where id=p_id and tenant_id=p_tenant for update;
    if c.id is null then raise exception 'Course not found'; end if;
    if p_action='save' then
      if c.updated_at <> (p_data->>'updated_at')::timestamptz then raise exception 'This draft changed. Reload before saving.'; end if;
      update training_courses set draft=p_data->'draft',updated_at=clock_timestamp() where id=c.id;
    elsif p_action='publish' then
      if c.archived then raise exception 'Restore the course before publishing'; end if;
      if c.updated_at <> (p_data->>'updated_at')::timestamptz then raise exception 'This draft changed. Reload before publishing.'; end if;
      v:=coalesce(c.published_version,0)+1;
      insert into training_revisions(course_id,version,content,published_by) values(c.id,v,c.draft,p_actor);
      update training_courses set published_version=v,updated_at=clock_timestamp() where id=c.id;
    elsif p_action='editors' then
      update training_courses set editors=array(select jsonb_array_elements_text(p_data->'editors')::uuid),updated_at=clock_timestamp() where id=c.id;
    else
      update training_courses set archived=(p_action='archive'),updated_at=clock_timestamp() where id=c.id;
    end if;
  elsif p_action='assign' then
    path:=(p_data->>'pathId')::uuid;
    if path is not null then
      select tp.course_ids into course_ids from training_paths tp where tp.id=path and tp.tenant_id=p_tenant for share;
      if course_ids is null then raise exception 'Path not found'; end if;
    else course_ids:=array[(p_data->>'courseId')::uuid]; end if;
    foreach uid in array array(select jsonb_array_elements_text(p_data->'userIds')::uuid) loop
      prereqs:='{}';
      foreach cid in array course_ids loop
        select * into c from training_courses where id=cid and tenant_id=p_tenant for share;
        if c.id is null or c.archived or c.published_version is null then raise exception 'All assigned courses must be published and active'; end if;
        insert into training_assignments(tenant_id,course_id,version,user_id,assigned_by,due_at,path_id,prerequisite_ids)
        values(p_tenant,c.id,c.published_version,uid,p_actor,(p_data->>'dueAt')::timestamptz,path,prereqs)
        on conflict(course_id,version,user_id,cycle) do nothing returning id into aid;
        if aid is not null then n:=n+1;
        else select id into aid from training_assignments where course_id=c.id and version=c.published_version and user_id=uid and cycle=0; end if;
        prereqs:=array_append(prereqs,aid);
      end loop;
    end loop;
  elsif p_action in ('progress','attempt','complete','signoff') then
    select * into a from training_assignments where id=p_id and tenant_id=p_tenant for update;
    if a.id is null then raise exception 'Assignment not found'; end if;
    if p_action<>'signoff' and a.user_id<>p_actor then raise exception 'Not your assignment'; end if;
    if exists(select 1 from training_assignments where id=any(a.prerequisite_ids) and completed_at is null) then
      raise exception 'Complete earlier courses in this path first';
    end if;
    select content into r from training_revisions where course_id=a.course_id and version=a.version;
    if p_action in ('progress','signoff') then
      select x into item from jsonb_array_elements(r->'lessons') x where x->>'id'=p_data->>'lessonId';
      if item is null then raise exception 'Lesson not found'; end if;
      if p_action='signoff' and a.user_id=p_actor then raise exception 'A different manager must verify this practical lesson'; end if;
      if p_action='signoff' and coalesce((item->>'managerSignoff')::boolean,false)=false then raise exception 'Lesson does not require sign-off'; end if;
      if p_action='progress' and coalesce((item->>'managerSignoff')::boolean,false) then raise exception 'A manager must sign off this lesson'; end if;
      insert into training_progress(assignment_id,lesson_id,signed_off_by)
      values(a.id,p_data->>'lessonId',case when p_action='signoff' then p_actor else null end)
      on conflict do nothing;
    elsif p_action='attempt' then
      if exists(select 1 from jsonb_array_elements(r->'lessons') x where not exists(
        select 1 from training_progress where assignment_id=a.id and lesson_id=x->>'id')) then raise exception 'Complete all lessons before taking the quiz'; end if;
      if a.completed_at is not null then raise exception 'Training already completed'; end if;
      if (select count(*) from training_attempts where assignment_id=a.id) >= (r->>'maxAttempts')::integer then raise exception 'Attempt limit reached'; end if;
      if jsonb_array_length(r->'questions')=0 then raise exception 'This course has no quiz'; end if;
      insert into training_attempts(assignment_id,score,passed,answers)
      values(a.id,(p_data->>'score')::integer,(p_data->>'passed')::boolean,p_data->'answers');
    else
      if exists(select 1 from jsonb_array_elements(r->'lessons') x where not exists(
        select 1 from training_progress where assignment_id=a.id and lesson_id=x->>'id')) then raise exception 'Complete all lessons first'; end if;
      if jsonb_array_length(r->'questions')>0 and not exists(select 1 from training_attempts where assignment_id=a.id and passed) then raise exception 'Pass the quiz first'; end if;
      if length(coalesce(r->>'acknowledgment',''))>0 and length(trim(coalesce(p_data->>'acknowledgedName','')))<2 then raise exception 'Enter your name to acknowledge this policy'; end if;
      update training_assignments set completed_at=coalesce(completed_at,now()),
        acknowledged_at=case when length(coalesce(r->>'acknowledgment',''))>0 then coalesce(acknowledged_at,now()) else null end,
        acknowledged_name=case when length(coalesce(r->>'acknowledgment',''))>0 then coalesce(acknowledged_name,p_data->>'acknowledgedName') else null end
        where id=a.id;
    end if;
  elsif p_action in ('import','rollback') then
    select * into b from training_import_batches where id=p_id and tenant_id=p_tenant for update;
    if b.id is null then raise exception 'Import batch not found'; end if;
    if p_action='import' then
      if b.status='imported' then return jsonb_build_object('count',0); end if;
      if b.status<>'staged' then raise exception 'Rolled-back batches cannot be imported again'; end if;
      if exists(select 1 from jsonb_array_elements(b.manifest->'items') x where x->>'status'='blocked') then raise exception 'Resolve blocked items in a new manifest before importing'; end if;
      for item in select * from jsonb_array_elements(b.manifest->'items') loop
        if item->>'status'='ready' then
          insert into training_courses(tenant_id,draft,created_by,import_batch_id,source_id)
          values(p_tenant,item->'course',p_actor,b.id,b.source||':'||(item->>'sourceId'));
          n:=n+1;
        end if;
      end loop;
      for item in select * from jsonb_array_elements(coalesce(b.manifest->'historicalRecords','[]')) loop
        insert into training_history(tenant_id,batch_id,source_id,record)
        values(p_tenant,b.id,b.source||':'||(item->>'sourceId'),item);
      end loop;
      update training_import_batches set status='imported',imported_at=now() where id=b.id;
    else
      if b.status<>'imported' then raise exception 'Only imported batches can be rolled back'; end if;
      select array_agg(id) into ids from training_courses where import_batch_id=b.id;
      perform 1 from training_courses where import_batch_id=b.id for update;
      if exists(select 1 from training_courses where import_batch_id=b.id and (published_version is not null or updated_at > b.imported_at))
        or exists(select 1 from training_paths tp where tp.tenant_id=p_tenant and tp.course_ids && ids) then
        raise exception 'Batch contains published, edited or path-linked courses. Rollback is blocked to preserve work.';
      end if;
      delete from training_courses where import_batch_id=b.id;
      delete from training_history where batch_id=b.id;
      update training_import_batches set status='rolled_back',rolled_back_at=now() where id=b.id;
    end if;
  else raise exception 'Unknown action';
  end if;
  insert into training_audit(tenant_id,actor_id,action,entity_id) values(p_tenant,p_actor,p_action,p_id);
  return jsonb_build_object('id',p_id,'ok',true,'count',n);
end $$;
revoke all on function public.training_mutate(uuid,uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.training_mutate(uuid,uuid,text,uuid,jsonb) to service_role;

-- Role-based enrollment and recurring refreshers. Called for the signed-in user
-- on portal entry; a manager can also apply rules to the entire tenant explicitly.
create function public.training_apply_rules(p_tenant uuid,p_user uuid default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare rule training_rules; usr record; c training_courses; cid uuid; cids uuid[];
  cycle_no integer; aid uuid; prereqs uuid[]; inserted integer:=0; due timestamptz;
begin
  -- Transaction-scoped lock makes concurrent portal opens idempotent.
  perform pg_advisory_xact_lock(hashtextextended('training-rules:'||p_tenant::text,0));
  for rule in select * from training_rules where tenant_id=p_tenant and enabled and starts_at<=now() order by id loop
    if rule.path_id is not null then
      select course_ids into cids from training_paths where id=rule.path_id and tenant_id=p_tenant;
    else cids:=array[rule.course_id]; end if;
    if cids is null or exists(select 1 from unnest(cids) x left join training_courses tc on tc.id=x
      where tc.id is null or tc.tenant_id<>p_tenant or tc.archived or tc.published_version is null) then continue; end if;
    for usr in select u.id from auth.users u join tenants t on t.id=p_tenant
      where (p_user is null or u.id=p_user)
      and (u.raw_user_meta_data->>'tenant_slug'=t.slug or u.raw_user_meta_data->>'tenant_id'=t.id::text)
      and (u.raw_user_meta_data->>'app_role'=rule.audience or
        rule.audience='staff' and u.raw_user_meta_data->>'app_role'='coach' and exists(
          select 1 from coaches co where co.user_id=u.id and co.tenant_id=t.id and co.capabilities->>'preset'='staff'))
      and (u.banned_until is null or u.banned_until<now())
    loop
      prereqs:='{}';
      foreach cid in array cids loop
        select * into c from training_courses where id=cid;
        -- Do not create a new cycle while an earlier enrollment remains unfinished.
        select id into aid from training_assignments where tenant_id=p_tenant and course_id=cid and user_id=usr.id and completed_at is null order by created_at desc limit 1;
        if aid is not null then prereqs:=array_append(prereqs,aid); continue; end if;
        if exists(select 1 from training_assignments where tenant_id=p_tenant and course_id=cid and user_id=usr.id and version=c.published_version and
          (rule.repeat_days is null or completed_at > now()-make_interval(days=>rule.repeat_days))) then
          select id into aid from training_assignments where tenant_id=p_tenant and course_id=cid and user_id=usr.id order by created_at desc limit 1;
          prereqs:=array_append(prereqs,aid); continue;
        end if;
        select coalesce(max(cycle),-1)+1 into cycle_no from training_assignments where course_id=cid and user_id=usr.id and version=c.published_version;
        due:=now()+make_interval(days=>rule.due_days);
        insert into training_assignments(tenant_id,course_id,version,user_id,assigned_by,due_at,path_id,prerequisite_ids,cycle,source)
        values(p_tenant,cid,c.published_version,usr.id,c.created_by,due,rule.path_id,prereqs,cycle_no,'rule:'||rule.id::text)
        on conflict(course_id,version,user_id,cycle) do nothing
        returning id into aid;
        if aid is not null then inserted:=inserted+1;
        else select id into aid from training_assignments where course_id=cid and version=c.published_version and user_id=usr.id and cycle=cycle_no; end if;
        prereqs:=array_append(prereqs,aid);
      end loop;
    end loop;
  end loop;
  return inserted;
end $$;
revoke all on function public.training_apply_rules(uuid,uuid) from public,anon,authenticated;
grant execute on function public.training_apply_rules(uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('training-private','training-private',false,262144000,
  array['application/pdf','text/plain','text/csv','image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','audio/mpeg',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip'])
on conflict(id) do nothing;
commit;
