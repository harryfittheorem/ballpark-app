import { createHash } from 'node:crypto';
import { dbError, manager, mutate, validateAssets, type TrainingContext } from './server';
import { requireValue, validateManifest, TrainingError, text } from './validation';
import { adaptTrainual } from './trainual';

export async function stageMigration(ctx:TrainingContext,body:Record<string,unknown>) {
  manager(ctx);
  let source = body.manifest;
  if(body.trainualExport !== undefined) {
    requireValue(typeof body.trainualExport==='string' && typeof body.companionMarkdown==='string','Both original Trainual JSON and companion Markdown files are required');
    let parsed: unknown;
    try { parsed=JSON.parse(body.trainualExport); } catch { throw new TrainingError('Invalid Trainual JSON'); }
    const adapted=adaptTrainual(parsed,body.companionMarkdown);
    // Original UTF-8 file contents are preserved in tenant-private batch storage, not public assets.
    adapted.sourceArchives=[
      {filename:text(body.jsonFilename ?? 'trainual-export.json',240,true),content:body.trainualExport,sha256:createHash('sha256').update(body.trainualExport).digest('hex')},
      {filename:text(body.markdownFilename ?? 'trainual-export.md',240,true),content:body.companionMarkdown,sha256:createHash('sha256').update(body.companionMarkdown).digest('hex')},
    ];
    source=adapted;
  }
  const manifest=validateManifest(source);
  for(const archive of manifest.sourceArchives ?? []) requireValue(createHash('sha256').update(archive.content).digest('hex')===archive.sha256,'Source archive checksum mismatch');
  // Preserve the exact parsed source manifest, not a lossy transformed substitute.
  const checksum=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const {data:existing,error:e}=await ctx.db.from('training_import_batches').select('id,status').eq('tenant_id',ctx.tenantId).eq('checksum',checksum).maybeSingle();
  dbError(e);
  for(const item of manifest.items) if(item.status==='ready' && item.course) {
    await validateAssets(ctx,item.course);
    // Legacy video/file inventory promises an independent asset, so keep its guard.
    // Adapted text drafts carry explicit linked-only references and source warnings;
    // they require reviewLinkedMedia at import, never a fabricated private asset.
    requireValue(!item.course.lessons.some(l=>['video','file'].includes(l.kind) && !l.assetId),
      `“${item.title}” still depends on an external media link. Upload and verify the original file, or mark this inventory item blocked.`);
  }
  const ready=manifest.items.filter(i=>i.status==='ready').length;
  const blocked=manifest.items.filter(i=>i.status==='blocked').length;
  if(existing) return {id:existing.id,ready,blocked,status:existing.status};
  // Detect overlaps instead of silently overwriting previously migrated source records.
  const {data:overlaps,error}=await ctx.db.from('training_courses').select('source_id').eq('tenant_id',ctx.tenantId)
    .in('source_id',manifest.items.filter(i=>i.status==='ready').map(i=>`${manifest.source}:${i.sourceId}`));
  dbError(error); requireValue(!overlaps?.length,'Some source content has already been imported. Reconcile it before staging another batch.',409);
  const {data,error:insert}=await ctx.db.from('training_import_batches').insert({
    tenant_id:ctx.tenantId,created_by:ctx.userId,source:manifest.source,checksum,manifest,
  }).select('id').single();
  dbError(insert); requireValue(data,'Could not stage migration',500);
  return {...data,ready,blocked};
}
export async function migrationAction(ctx:TrainingContext,id:string,body:Record<string,unknown>) {
  manager(ctx);
  requireValue(['import','rollback','export'].includes(String(body.action)),'Unknown migration action');
  const {data,error}=await ctx.db.from('training_import_batches').select('*').eq('tenant_id',ctx.tenantId).eq('id',id).maybeSingle();
  dbError(error); requireValue(data,'Migration batch not found',404);
  if(body.action==='export') return data.manifest;
  if(body.action==='import') {
    const manifest=validateManifest(data.manifest);
    requireValue(!manifest.items.some(i=>i.course?.lessons.some(l=>l.references?.length)) || body.reviewLinkedMedia===true,
      'Confirm review of linked-only media and missing source content before importing drafts.');
    for(const i of manifest.items) if(i.status==='ready' && i.course) await validateAssets(ctx,i.course);
  }
  return mutate(ctx,String(body.action),id);
}
