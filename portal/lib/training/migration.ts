import { createHash } from 'node:crypto';
import { dbError, manager, mutate, validateAssets, type TrainingContext } from './server';
import { requireValue, validateManifest } from './validation';

export async function stageMigration(ctx:TrainingContext,body:Record<string,unknown>) {
  manager(ctx);
  const manifest=validateManifest(body.manifest);
  // Preserve the exact parsed source manifest, not a lossy transformed substitute.
  const checksum=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const {data:existing,error:e}=await ctx.db.from('training_import_batches').select('id,status').eq('tenant_id',ctx.tenantId).eq('checksum',checksum).maybeSingle();
  dbError(e);
  for(const item of manifest.items) if(item.status==='ready' && item.course) {
    await validateAssets(ctx,item.course);
    // An external-only media link must not be represented as an independent migrated asset.
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
    for(const i of manifest.items) if(i.status==='ready' && i.course) await validateAssets(ctx,i.course);
  }
  return mutate(ctx,String(body.action),id);
}
