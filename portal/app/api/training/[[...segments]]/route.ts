import { NextRequest, NextResponse } from 'next/server';
import { trainingContext } from '@/lib/training/server';
import { TrainingError, requireValue, uuid } from '@/lib/training/validation';
import { courseDetail, createCourse, overview, updateCourse } from '@/lib/training/courses';
import { assignTraining, deletePath, learningAction, savePath } from '@/lib/training/learning';
import { reportsCsv, trainingReports } from '@/lib/training/reports';
import { migrationAction, stageMigration } from '@/lib/training/migration';
import { assetUrl, confirmAsset, createAsset } from '@/lib/training/assets';
import { applyRules, listRules, saveRule } from '@/lib/training/rules';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=120;
type Params={params:Promise<{segments?:string[]}>};
async function handler(req:NextRequest,{params}:Params) {
  try {
    if(req.method!=='GET') {
      const origin=req.headers.get('origin');
      requireValue(origin && new URL(origin).host===req.headers.get('host'),'Cross-site requests are not allowed',403);
    }
    const ctx=await trainingContext();
    const segments=(await params).segments ?? [];
    requireValue(segments.length<=2,'Not found',404);
    const [resource,id]=segments;
    if(id)uuid(id);
    let body:Record<string,unknown>={};
    if(!['GET','DELETE'].includes(req.method)) {
      requireValue(Number(req.headers.get('content-length') ?? 0)<=8*1024*1024,'Request too large',413);
      const raw=await req.text();
      requireValue(Buffer.byteLength(raw)<=8*1024*1024,'Request too large',413);
      try {body=JSON.parse(raw);} catch {throw new TrainingError('Invalid JSON request');}
      requireValue(body && typeof body==='object' && !Array.isArray(body),'Expected a JSON object');
    }
    let result:unknown;
    if(req.method==='GET') {
      if(!resource)result=await overview(ctx);
      else if(resource==='courses' && id)result=await courseDetail(ctx,id,req.nextUrl.searchParams.get('assignmentId'));
      else if(resource==='assets' && id)result=await assetUrl(ctx,id);
      else if(resource==='rules' && !id)result=await listRules(ctx);
      else if(resource==='reports' && !id) {
        const report=await trainingReports(ctx);
        if(req.nextUrl.searchParams.get('format')==='csv')return new NextResponse(reportsCsv(report.rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="training-report.csv"','Cache-Control':'no-store'}});
        result=report;
      } else throw new TrainingError('Not found',404);
    } else if(req.method==='POST') {
      if(resource==='courses' && !id)result=await createCourse(ctx,body);
      else if(resource==='assignments' && !id)result=await assignTraining(ctx,body);
      else if(['progress','attempts','complete','signoff'].includes(resource) && !id)result=await learningAction(ctx,resource,body);
      else if(resource==='paths' && !id)result=await savePath(ctx,body);
      else if(resource==='rules' && !id)result=body.action==='apply' ? await applyRules(ctx,true) : await saveRule(ctx,body);
      else if(resource==='migrations')result=id ? await migrationAction(ctx,id,body) : await stageMigration(ctx,body);
      else if(resource==='assets') {
        if(id)requireValue(body.action==='confirm','Unknown file action');
        result=id ? await confirmAsset(ctx,id) : await createAsset(ctx,body);
      } else throw new TrainingError('Not found',404);
    } else if(req.method==='PATCH') {
      if(resource==='courses' && id)result=await updateCourse(ctx,id,body);
      else if(resource==='paths' && id)result=await savePath(ctx,body,id);
      else if(resource==='rules' && id)result=await saveRule(ctx,body,id);
      else throw new TrainingError('Not found',404);
    } else if(req.method==='DELETE' && resource==='paths' && id)result=await deletePath(ctx,id);
    else throw new TrainingError('Not found',404);
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    if(error instanceof TrainingError)return NextResponse.json({error:error.message},{status:error.status});
    console.error('[training-api]',error instanceof Error ? error.message : 'Unexpected failure');
    return NextResponse.json({error:'Training is temporarily unavailable. Please retry.'},{status:500});
  }
}
export const GET=handler;
export const POST=handler;
export const PATCH=handler;
export const DELETE=handler;
