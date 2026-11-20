import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';
import type { Assignment, Course, CourseContent, Revision, TrainingPerson, TrainingRole } from './types';
import { requireValue, TrainingError } from './validation';

export async function trainingContext() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  requireValue(!error && user, 'Sign in to access training', 401);
  const { data: { session } } = await auth.auth.getSession();
  requireValue(session && session.user.id === user.id, 'Session could not be verified', 401);
  const role = readAppRole(session);
  const tenantId = readTenantId(session);
  requireValue(tenantId && ['owner','admin','coach'].includes(role), 'Training is restricted to business team members', 403);
  const db=createServiceClient();
  let isStaff=false;
  if(role==='coach') {
    const {data,error:staffError}=await db.from('coaches').select('capabilities').eq('tenant_id',tenantId).eq('user_id',user.id).maybeSingle();
    dbError(staffError);isStaff=data?.capabilities?.preset==='staff';
  }
  return { db, tenantId, userId:user.id, email:user.email ?? '', role:role as TrainingRole, isStaff, canManage:role === 'owner' || role === 'admin' };
}
export type TrainingContext = Awaited<ReturnType<typeof trainingContext>>;
export function audienceAllows(ctx:TrainingContext,content:CourseContent) {
  return content.audience.includes(ctx.role) || ctx.isStaff && content.audience.includes('staff');
}
export function manager(ctx: TrainingContext) {
  requireValue(ctx.canManage, 'Only owners and admins may manage training', 403);
}
export function dbError(error: {message:string;code?:string} | null) {
  if (!error) return;
  if (error.code === '42P01' || error.code === 'PGRST205') throw new TrainingError('Training storage is not installed yet. Apply the training database migration.',503);
  if (error.code === '23505') throw new TrainingError('This source item or enrollment already exists; no duplicate was created.',409);
  if (error.code === 'P0001') throw new TrainingError(error.message,409);
  console.error('[training]',error.code,error.message);
  throw new TrainingError('Training could not be saved or loaded. Please retry.',500);
}
export async function courseById(ctx: TrainingContext,id:string): Promise<Course> {
  const {data,error} = await ctx.db.from('training_courses').select('*').eq('tenant_id',ctx.tenantId).eq('id',id).maybeSingle();
  dbError(error); requireValue(data,'Course not found',404); return data as Course;
}
export async function revision(ctx:TrainingContext,courseId:string,version:number): Promise<Revision> {
  const {data,error}=await ctx.db.from('training_revisions').select('*').eq('course_id',courseId).eq('version',version).single();
  dbError(error); requireValue(data,'Published version not found',404); return data as Revision;
}
export async function assignmentById(ctx:TrainingContext,id:string,allowManager=false): Promise<Assignment & {prerequisite_ids:string[]}> {
  const {data,error}=await ctx.db.from('training_assignments').select('*').eq('tenant_id',ctx.tenantId).eq('id',id).maybeSingle();
  dbError(error); requireValue(data && (data.user_id === ctx.userId || allowManager && ctx.canManage),'Assignment not found',404);
  return data;
}
export async function mutate(ctx:TrainingContext,action:string,id:string|null,data:unknown={}) {
  const {data:result,error}=await ctx.db.rpc('training_mutate',{p_tenant:ctx.tenantId,p_actor:ctx.userId,p_action:action,p_id:id,p_data:data});
  dbError(error); return result;
}
export async function audit(ctx:TrainingContext,action:string,id:string,detail:unknown={}) {
  const {error}=await ctx.db.from('training_audit').insert({tenant_id:ctx.tenantId,actor_id:ctx.userId,action,entity_id:id,detail}); dbError(error);
}
export async function validateAssets(ctx:TrainingContext,content:CourseContent) {
  const ids=[...new Set(content.lessons.flatMap(l=>l.assetId?[l.assetId]:[]))];
  if (!ids.length) return;
  const {data,error}=await ctx.db.from('training_assets').select('id,mime,uploaded_by').eq('tenant_id',ctx.tenantId).eq('status','ready').in('id',ids);
  dbError(error); requireValue(data?.length===ids.length,'Some attached files are missing, pending, or belong to another business');
  if(!ctx.canManage) {
    const {data:editable,error:editError}=await ctx.db.from('training_courses').select('draft').eq('tenant_id',ctx.tenantId).contains('editors',[ctx.userId]);
    dbError(editError);
    const alreadyAccessible=new Set((editable ?? []).flatMap(c=>(c.draft as CourseContent).lessons.flatMap(l=>l.assetId?[l.assetId]:[])));
    requireValue(data.every(a=>a.uploaded_by===ctx.userId || alreadyAccessible.has(a.id)),'You can only attach your own uploads or files already in your editable courses',403);
  }
  for (const l of content.lessons) if(l.kind==='video' && l.assetId) requireValue(data?.find(a=>a.id===l.assetId)?.mime.startsWith('video/'),'Video lessons require a video file');
}
export async function people(ctx:TrainingContext): Promise<TrainingPerson[]> {
  manager(ctx);
  const {data:tenant,error:tenantError}=await ctx.db.from('tenants').select('slug').eq('id',ctx.tenantId).single();
  dbError(tenantError);
  const {data:coaches,error:coachesError}=await ctx.db.from('coaches').select('user_id,capabilities').eq('tenant_id',ctx.tenantId);
  dbError(coachesError);
  const result:TrainingPerson[]=[];
  for (let page=1; ;page++) {
    const {data,error}=await ctx.db.auth.admin.listUsers({page,perPage:1000});
    if(error) throw new TrainingError('Unable to load team members',503);
    for (const u of data.users) {
      const meta=u.user_metadata;
      const role=meta.app_role;
      if (!['owner','admin','coach'].includes(role) || !(meta.tenant_slug===tenant?.slug || meta.tenant_id===ctx.tenantId)) continue;
      result.push({id:u.id,email:u.email ?? '',name:meta.full_name || [meta.first_name,meta.last_name].filter(Boolean).join(' ') || u.email || 'Team member',
        role,staff:coaches?.some(c=>c.user_id===u.id && c.capabilities?.preset==='staff') ?? false});
    }
    if(data.users.length<1000) break;
    requireValue(page<100,'Team directory is too large for this operation',503);
  }
  return result;
}
export async function canReadCourse(ctx:TrainingContext,c:Course,versionNumber?:number) {
  if(ctx.canManage || c.editors.includes(ctx.userId)) return true;
  const {data,error}=await ctx.db.from('training_assignments').select('id').eq('tenant_id',ctx.tenantId).eq('course_id',c.id).eq('user_id',ctx.userId).limit(1);
  dbError(error);
  if(data?.length) return true;
  if(c.archived || !c.published_version) return false;
  const r=await revision(ctx,c.id,versionNumber ?? c.published_version);
  return audienceAllows(ctx,r.content);
}
