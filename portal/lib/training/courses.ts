import type { Course, CourseContent, Revision } from './types';
import { assignmentById, audienceAllows, audit, canReadCourse, courseById, dbError, manager, mutate, people, revision, validateAssets, type TrainingContext } from './server';
import { learnerContent, requireValue, uuid, validateCourse } from './validation';
import { applyRules } from './rules';

export async function overview(ctx:TrainingContext) {
  await applyRules(ctx);
  const [coursesResult,assignmentsResult,pathsResult,assetsResult,batchesResult] = await Promise.all([
    ctx.db.from('training_courses').select('*').eq('tenant_id',ctx.tenantId).order('updated_at',{ascending:false}).limit(1000),
    (ctx.canManage ? ctx.db.from('training_assignments').select('*').eq('tenant_id',ctx.tenantId) :
      ctx.db.from('training_assignments').select('*').eq('tenant_id',ctx.tenantId).eq('user_id',ctx.userId)).limit(1000),
    ctx.db.from('training_paths').select('*').eq('tenant_id',ctx.tenantId).limit(1000),
    ctx.canManage ? ctx.db.from('training_assets').select('id,filename,mime,size,checksum,status,created_at').eq('tenant_id',ctx.tenantId).eq('status','ready').limit(1000) : Promise.resolve({data:[],error:null}),
    ctx.canManage ? ctx.db.from('training_import_batches').select('*').eq('tenant_id',ctx.tenantId).order('created_at',{ascending:false}).limit(100) : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [coursesResult,assignmentsResult,pathsResult,assetsResult,batchesResult]) dbError(result.error);
  for(const result of [coursesResult,assignmentsResult,pathsResult,assetsResult]) requireValue((result.data?.length ?? 0)<1000,'Training list exceeds the current page limit. Please contact an administrator rather than using incomplete results.',503);
  let courses=(coursesResult.data ?? []) as Course[];
  if(!ctx.canManage) {
    const published=courses.filter(c=>c.published_version);
    let revs:Revision[]=[];
    if(published.length) {
      const {data,error}=await ctx.db.from('training_revisions').select('*').in('course_id',published.map(c=>c.id)).limit(1000);
      dbError(error); requireValue((data?.length ?? 0)<1000,'Too many training versions to list safely',503); revs=data ?? [];
    }
    courses=courses.flatMap(c=>{
      if(c.editors.includes(ctx.userId)) return [c];
      const r=revs.find(r=>r.course_id===c.id && r.version===c.published_version);
      if(!r || c.archived || !audienceAllows(ctx,r.content)) {
        // Only assigned revisions are disclosed when current content is restricted.
        const a=assignmentsResult.data?.find(a=>a.course_id===c.id);
        const assigned=revs.find(r=>r.course_id===c.id && r.version===a?.version);
        return assigned ? [{...c,draft:learnerContent(assigned.content),editors:[]}] : [];
      }
      return [{...c,draft:learnerContent(r.content),editors:[]}];
    });
  }
  const visible=new Set(courses.map(c=>c.id));
  return {viewer:{id:ctx.userId,role:ctx.role,canManage:ctx.canManage},courses,
    assignments:assignmentsResult.data ?? [],people:ctx.canManage ? await people(ctx) : [],
    paths:ctx.canManage ? pathsResult.data : pathsResult.data?.filter(p=>p.course_ids.every((id:string)=>visible.has(id))),
    assets:assetsResult.data,batches:batchesResult.data};
}
export async function courseDetail(ctx:TrainingContext,id:string,assignmentId:string|null) {
  const c=await courseById(ctx,id);
  requireValue(await canReadCourse(ctx,c),'Course not found',404);
  let assignment=assignmentId ? await assignmentById(ctx,uuid(assignmentId),true) : null;
  if(assignment) requireValue(assignment.course_id===id,'Enrollment belongs to another course');
  if(!assignment) {
    const {data,error}=await ctx.db.from('training_assignments').select('*').eq('tenant_id',ctx.tenantId).eq('user_id',ctx.userId).eq('course_id',id).order('version',{ascending:false}).limit(1);
    dbError(error); assignment=data?.[0] ?? null;
  }
  const canEdit=ctx.canManage || c.editors.includes(ctx.userId);
  let revisions:Revision[]=[];
  if(canEdit) {
    const {data,error}=await ctx.db.from('training_revisions').select('*').eq('course_id',id).order('version',{ascending:false});
    dbError(error); revisions=data ?? [];
  }
  let content:CourseContent;
  if(assignment) content=(await revision(ctx,id,assignment.version)).content;
  else if(canEdit) content=c.draft;
  else { requireValue(c.published_version,'Course not published',404); content=(await revision(ctx,id,c.published_version)).content; }
  const [p,a]=assignment ? await Promise.all([
    ctx.db.from('training_progress').select('*').eq('assignment_id',assignment.id),
    ctx.db.from('training_attempts').select('id,assignment_id,score,passed,created_at').eq('assignment_id',assignment.id).order('created_at'),
  ]) : [{data:[],error:null},{data:[],error:null}];
  dbError(p.error); dbError(a.error);
  return {course:canEdit ? c : {...c,draft:learnerContent(content),editors:[]},content:canEdit ? content : learnerContent(content),
    revisions,assignment,progress:p.data,attempts:a.data};
}
export async function createCourse(ctx:TrainingContext,body:Record<string,unknown>) {
  manager(ctx);
  const draft=validateCourse(body.draft);
  await validateAssets(ctx,draft);
  const {data,error}=await ctx.db.from('training_courses').insert({tenant_id:ctx.tenantId,created_by:ctx.userId,draft}).select('id').single();
  dbError(error); requireValue(data,'Could not create course',500); await audit(ctx,'create',data.id); return data;
}
export async function updateCourse(ctx:TrainingContext,id:string,body:Record<string,unknown>) {
  const c=await courseById(ctx,id);
  if(body.draft) {
    requireValue(ctx.canManage || c.editors.includes(ctx.userId),'You cannot edit this course',403);
    const draft=validateCourse(body.draft);
    await validateAssets(ctx,draft);
    requireValue(typeof body.updated_at==='string','Reload the draft before saving',409);
    return mutate(ctx,'save',id,{draft,updated_at:body.updated_at});
  }
  manager(ctx);
  if(body.action==='publish') {
    const draft=validateCourse(c.draft,true); await validateAssets(ctx,draft);
    return mutate(ctx,'publish',id,{updated_at:c.updated_at});
  }
  if(body.action==='duplicate') return createCourse(ctx,{draft:{...c.draft,title:(c.draft.title+' (copy)').slice(0,180)}});
  if(body.action==='editors') {
    requireValue(Array.isArray(body.editors) && body.editors.length<=100,'Choose valid editors');
    const team=await people(ctx);
    const ids=body.editors.map(uuid);
    requireValue(ids.every(id=>team.some(p=>p.id===id)),'Editors must belong to this business');
    return mutate(ctx,'editors',id,{editors:ids});
  }
  requireValue(body.action==='archive' || body.action==='restore','Unknown course action');
  return mutate(ctx,body.action,id);
}
