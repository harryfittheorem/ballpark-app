import { createHash, randomUUID } from 'node:crypto';
import { audienceAllows, dbError, type TrainingContext } from './server';
import { requireValue, text } from './validation';
import type { CourseContent } from './types';
import { TRAINING_MIMES, trainingFileMime } from './formats';

const BUCKET='training-private';
const MIMES=Object.values(TRAINING_MIMES);
const MAX_SIZE=250*1024*1024;
export async function createAsset(ctx:TrainingContext,body:Record<string,unknown>) {
  if(!ctx.canManage) {
    const {data,error}=await ctx.db.from('training_courses').select('id').eq('tenant_id',ctx.tenantId).contains('editors',[ctx.userId]).limit(1);
    dbError(error); requireValue(data?.length,'Only managers or designated content editors can upload files',403);
  }
  const filename=text(body.filename,240,true);
  const mime=text(body.mime,100,true);
  requireValue(MIMES.includes(mime) && trainingFileMime(filename)===mime,'Use supported PDF, text, Office, ZIP, image, MP4, WebM or MP3 files with matching extensions');
  requireValue(typeof body.size==='number' && Number.isInteger(body.size) && body.size>0 && body.size<=MAX_SIZE,'Files must be between 1 byte and 250 MB');
  const id=randomUUID();
  const path=`${ctx.tenantId}/${id}/${filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const {error}=await ctx.db.from('training_assets').insert({id,tenant_id:ctx.tenantId,uploaded_by:ctx.userId,filename,mime,size:body.size,path});
  dbError(error);
  const {data,error:uploadError}=await ctx.db.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
  requireValue(!uploadError && data,'Could not prepare private upload',503);
  return {id,path,token:data.token,signedUrl:data.signedUrl};
}
async function getAsset(ctx:TrainingContext,id:string) {
  const {data,error}=await ctx.db.from('training_assets').select('*').eq('tenant_id',ctx.tenantId).eq('id',id).maybeSingle();
  dbError(error); requireValue(data,'File not found',404); return data;
}
export async function confirmAsset(ctx:TrainingContext,id:string) {
  const asset=await getAsset(ctx,id);
  requireValue(ctx.canManage || asset.uploaded_by===ctx.userId,'You cannot confirm this upload',403);
  if(asset.status==='ready') return {ok:true};
  const {data,error}=await ctx.db.storage.from(BUCKET).createSignedUrl(asset.path,300);
  requireValue(!error && data,'Unable to verify uploaded file',503);
  const response=await fetch(data.signedUrl,{cache:'no-store'});
  requireValue(response.ok && response.body,'Upload not found. Retry uploading before confirming.',409);
  // Hash streamed bytes rather than trusting a client-supplied checksum.
  const hash=createHash('sha256'); let size=0;
  const reader=response.body.getReader();
  try {
    while(true) {
      const {done,value}=await reader.read(); if(done)break;
      size+=value.byteLength; requireValue(size<=MAX_SIZE,'Uploaded file exceeds the size limit');
      hash.update(value);
    }
  } finally { await reader.cancel(); }
  requireValue(size===asset.size,'Uploaded file size differs from the selected file. Upload again.',409);
  const {error:update}=await ctx.db.from('training_assets').update({status:'ready',checksum:hash.digest('hex')}).eq('tenant_id',ctx.tenantId).eq('id',id);
  dbError(update); return {ok:true};
}
export async function assetUrl(ctx:TrainingContext,id:string) {
  const asset=await getAsset(ctx,id);
  requireValue(asset.status==='ready','File upload has not been verified',409);
  let allowed=ctx.canManage;
  if(!allowed) {
    // An uploader may preview their own attachment; others need a visible course
    // revision that actually references the asset (not merely the same tenant).
    allowed=asset.uploaded_by===ctx.userId;
    if(!allowed) {
      const {data:assignments,error:aError}=await ctx.db.from('training_assignments').select('course_id,version').eq('tenant_id',ctx.tenantId).eq('user_id',ctx.userId);
      dbError(aError);
      const {data:courses,error:cError}=await ctx.db.from('training_courses').select('id,published_version,editors,draft,archived').eq('tenant_id',ctx.tenantId);
      dbError(cError);
      for(const c of courses ?? []) {
        if(c.editors.includes(ctx.userId) && (c.draft as CourseContent).lessons.some(l=>l.assetId===id)) {allowed=true;break;}
        const versions=[...new Set([...(assignments ?? []).filter(a=>a.course_id===c.id).map(a=>a.version),...(!c.archived && c.published_version?[c.published_version]:[])])];
        if(!versions.length)continue;
        const {data:rs,error}=await ctx.db.from('training_revisions').select('version,content').eq('course_id',c.id).in('version',versions);
        dbError(error);
        if(rs?.some(r=>{
          const content=r.content as CourseContent;
          const assigned=assignments?.some(a=>a.course_id===c.id && a.version===r.version);
          return (assigned || r.version===c.published_version && !c.archived && audienceAllows(ctx,content)) &&
            content.lessons.some(l=>l.assetId===id);
        })) {allowed=true;break;}
      }
    }
  }
  requireValue(allowed,'File not found',404);
  const {data,error}=await ctx.db.storage.from(BUCKET).createSignedUrl(asset.path,600);
  requireValue(!error && data,'Unable to open private file',503); return {url:data.signedUrl};
}
