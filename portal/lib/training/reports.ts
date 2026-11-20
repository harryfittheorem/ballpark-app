import { dbError, manager, people, type TrainingContext } from './server';
import { csvCell, requireValue } from './validation';
import type { CourseContent } from './types';

export async function trainingReports(ctx:TrainingContext) {
  manager(ctx);
  const [ar,hr,log,team]=await Promise.all([
    ctx.db.from('training_assignments').select('*').eq('tenant_id',ctx.tenantId).order('created_at',{ascending:false}).limit(1000),
    ctx.db.from('training_history').select('*').eq('tenant_id',ctx.tenantId).limit(1000),
    ctx.db.from('training_audit').select('*').eq('tenant_id',ctx.tenantId).order('created_at',{ascending:false}).limit(100),
    people(ctx),
  ]);
  dbError(ar.error);dbError(hr.error);dbError(log.error);
  requireValue((ar.data?.length ?? 0)<1000 && (hr.data?.length ?? 0)<1000,'Report exceeds the current export limit. Contact an administrator; no incomplete report has been returned.',503);
  const assignments=ar.data ?? [];
  const ids=assignments.map(a=>a.id), courseIds=[...new Set(assignments.map(a=>a.course_id))];
  const [pr,atr,rr]=ids.length ? await Promise.all([
    ctx.db.from('training_progress').select('*').in('assignment_id',ids).limit(10000),
    ctx.db.from('training_attempts').select('*').in('assignment_id',ids).limit(10000),
    ctx.db.from('training_revisions').select('*').in('course_id',courseIds).limit(10000),
  ]) : [{data:[],error:null},{data:[],error:null},{data:[],error:null}];
  dbError(pr.error);dbError(atr.error);dbError(rr.error);
  // Supabase's configured row cap is commonly 1000; fail visibly rather than reporting partial totals.
  for(const r of [pr,atr,rr]) requireValue((r.data?.length ?? 0)<1000,'Report detail exceeds the current limit. Narrow the dataset before exporting.',503);
  const rows=assignments.map(a=>{
    const person=team.find(p=>p.id===a.user_id);
    const content=rr.data?.find(r=>r.course_id===a.course_id && r.version===a.version)?.content as CourseContent|undefined;
    requireValue(content,'An assignment references missing training content',500);
    const attempts=atr.data?.filter(t=>t.assignment_id===a.id) ?? [];
    return {assignmentId:a.id,courseId:a.course_id,course:content.title,userId:a.user_id,name:person?.name ?? 'Former team member',email:person?.email ?? '',
      version:a.version,dueAt:a.due_at,completedAt:a.completed_at,acknowledgedAt:a.acknowledged_at,acknowledgedName:a.acknowledged_name,
      progress:pr.data?.filter(p=>p.assignment_id===a.id).length ?? 0,total:content.lessons.length,
      score:attempts.length ? Math.max(...attempts.map(t=>t.score)) : null,
      status:a.completed_at ? 'completed' : a.due_at && Date.parse(a.due_at)<Date.now() ? 'overdue' :
        pr.data?.some(p=>p.assignment_id===a.id) || attempts.length ? 'in_progress' : 'not_started',source:a.source};
  });
  return {rows,history:hr.data ?? [],audit:log.data ?? []};
}
export function reportsCsv(rows:Record<string,unknown>[]) {
  const columns=['name','email','course','version','status','progress','total','score','dueAt','completedAt','acknowledgedAt','acknowledgedName','source'];
  return [columns.map(csvCell).join(','),...rows.map(row=>columns.map(c=>csvCell(row[c])).join(','))].join('\r\n');
}
