import { assignmentById, audienceAllows, audit, courseById, dbError, manager, mutate, people, revision, type TrainingContext } from './server';
import { gradeQuiz, requireValue, text, uuid } from './validation';

export async function assignTraining(ctx:TrainingContext,body:Record<string,unknown>) {
  requireValue(Array.isArray(body.userIds) && body.userIds.length>0 && body.userIds.length<=200,'Choose 1–200 people');
  const userIds=[...new Set(body.userIds.map(uuid))];
  const courseId=body.courseId ? uuid(body.courseId) : null;
  const pathId=body.pathId ? uuid(body.pathId) : null;
  requireValue(Boolean(courseId)!==Boolean(pathId),'Choose one course or learning path');
  let courseIds=courseId ? [courseId] : [];
  if(pathId) {
    const {data,error}=await ctx.db.from('training_paths').select('course_ids').eq('tenant_id',ctx.tenantId).eq('id',pathId).single();
    dbError(error); requireValue(data,'Path not found',404); courseIds=data.course_ids;
  }
  if(!ctx.canManage) {
    requireValue(userIds.length===1 && userIds[0]===ctx.userId,'You can only enroll yourself',403);
    requireValue(!body.dueAt,'Only managers can set deadlines',403);
  } else {
    const team=await people(ctx);
    requireValue(userIds.every(id=>team.some(p=>p.id===id)),'Assignments must stay within this business');
  }
  for(const id of courseIds) {
    const c=await courseById(ctx,id);
    requireValue(!c.archived && c.published_version,'All courses must be published and active');
    if(!ctx.canManage) requireValue(audienceAllows(ctx,(await revision(ctx,id,c.published_version)).content),'This course is restricted',403);
  }
  requireValue(!body.dueAt || typeof body.dueAt==='string' && Number.isFinite(Date.parse(body.dueAt)),'Invalid due date');
  return mutate(ctx,'assign',null,{userIds,courseId,pathId,dueAt:body.dueAt || null});
}
export async function learningAction(ctx:TrainingContext,action:string,body:Record<string,unknown>) {
  const id=uuid(body.assignmentId);
  if(action==='signoff') manager(ctx);
  const assignment=await assignmentById(ctx,id,action==='signoff');
  const r=await revision(ctx,assignment.course_id,assignment.version);
  if(action==='attempts') {
    const score=gradeQuiz(r.content.questions,body.answers);
    const passed=score>=r.content.passingScore;
    await mutate(ctx,'attempt',id,{score,passed,answers:body.answers}); return {score,passed};
  }
  if(action==='complete') {
    const acknowledgedName=body.acknowledgedName ? text(body.acknowledgedName,180,true) : '';
    return mutate(ctx,'complete',id,{acknowledgedName});
  }
  const lessonId=text(body.lessonId,100,true);
  const lesson=r.content.lessons.find(l=>l.id===lessonId);
  requireValue(lesson,'Lesson not found',404);
  if(action==='progress' && lesson.kind==='checklist') {
    requireValue(Array.isArray(body.checked),'Check every item before completing this lesson');
    const checked=new Set(body.checked);
    requireValue(lesson.checklist?.every((_,i)=>checked.has(i)),'Complete every checklist item first');
  }
  return mutate(ctx,action,id,{lessonId});
}
export async function savePath(ctx:TrainingContext,body:Record<string,unknown>,id?:string) {
  manager(ctx);
  const title=text(body.title,180,true), description=text(body.description ?? '',3000);
  requireValue(Array.isArray(body.courseIds) && body.courseIds.length>0 && body.courseIds.length<=50,'Choose 1–50 courses');
  const courseIds=body.courseIds.map(uuid);
  requireValue(new Set(courseIds).size===courseIds.length,'A path cannot repeat a course');
  for(const cid of courseIds) { const c=await courseById(ctx,cid); requireValue(!c.archived,'Restore archived courses before using them in a path'); }
  const values={title,description,course_ids:courseIds};
  const query=id ? ctx.db.from('training_paths').update(values).eq('tenant_id',ctx.tenantId).eq('id',id) :
    ctx.db.from('training_paths').insert({...values,tenant_id:ctx.tenantId});
  const {data,error}=await query.select('id').single(); dbError(error); requireValue(data,'Path not found',404);
  await audit(ctx,id?'path_update':'path_create',data.id); return data;
}
export async function deletePath(ctx:TrainingContext,id:string) {
  manager(ctx);
  const {count,error}=await ctx.db.from('training_assignments').select('id',{count:'exact',head:true}).eq('tenant_id',ctx.tenantId).eq('path_id',id);
  dbError(error); requireValue(!count,'This path has assignments and cannot be deleted',409);
  const {error:del}=await ctx.db.from('training_paths').delete().eq('tenant_id',ctx.tenantId).eq('id',id); dbError(del);
  await audit(ctx,'path_delete',id); return {ok:true};
}
