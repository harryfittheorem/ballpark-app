import { audit, courseById, dbError, manager, type TrainingContext } from './server';
import { requireValue, text, uuid } from './validation';

export async function listRules(ctx:TrainingContext) {
  manager(ctx);
  const {data,error}=await ctx.db.from('training_rules').select('*').eq('tenant_id',ctx.tenantId).order('created_at',{ascending:false});
  dbError(error); return {rules:data ?? []};
}
export async function applyRules(ctx:TrainingContext,all=false) {
  if(all)manager(ctx);
  const {data,error}=await ctx.db.rpc('training_apply_rules',{p_tenant:ctx.tenantId,p_user:all ? null : ctx.userId});
  dbError(error); return {count:data};
}
export async function saveRule(ctx:TrainingContext,body:Record<string,unknown>,id?:string) {
  manager(ctx);
  const title=text(body.title,180,true);
  requireValue(['owner','admin','coach','staff'].includes(String(body.audience)),'Choose a role');
  const course_id=body.courseId ? uuid(body.courseId) : null;
  const path_id=body.pathId ? uuid(body.pathId) : null;
  requireValue(Boolean(course_id)!==Boolean(path_id),'Choose one course or path');
  if(course_id) {const c=await courseById(ctx,course_id);requireValue(c.published_version && !c.archived,'Select an active published course');}
  if(path_id) {
    const {data,error}=await ctx.db.from('training_paths').select('course_ids').eq('tenant_id',ctx.tenantId).eq('id',path_id).maybeSingle();
    dbError(error);requireValue(data,'Path not found',404);
    for(const cid of data.course_ids) {const c=await courseById(ctx,cid);requireValue(c.published_version && !c.archived,'Publish every course in the path first');}
  }
  requireValue(Number.isInteger(body.dueDays) && Number(body.dueDays)>=1 && Number(body.dueDays)<=365,'Deadline must be 1–365 days');
  requireValue(body.repeatDays===null || Number.isInteger(body.repeatDays) && Number(body.repeatDays)>=1 && Number(body.repeatDays)<=730,'Refresh interval must be 1–730 days, or empty');
  const values={title,audience:body.audience,course_id,path_id,due_days:body.dueDays,repeat_days:body.repeatDays,enabled:body.enabled!==false};
  const query=id ? ctx.db.from('training_rules').update(values).eq('tenant_id',ctx.tenantId).eq('id',id) :
    ctx.db.from('training_rules').insert({...values,tenant_id:ctx.tenantId});
  const {data,error}=await query.select('id').single();dbError(error);requireValue(data,'Rule not found',404);
  await audit(ctx,'rule_save',data.id);return data;
}
