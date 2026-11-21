import { assertUUID, literal, localSQL } from './local';
import { sendPilotClaim, type PilotClaim } from './pilotTransport';
import type { CRMContext } from './http';

export async function pilotRPC(ctx: CRMContext, name: string, args: Record<string, unknown>) {
  if (ctx.preview) {
    if (name === 'crm_pilot_status') return localSQL(
      `SELECT crm_pilot_status('${assertUUID(String(args.p_location))}');`, ctx);
    if (name === 'crm_pilot_manage') return localSQL(
      `SELECT crm_pilot_manage('${assertUUID(String(args.p_location))}',${literal(args.p_action)}#>>'{}',${literal(args.p_payload)});`, ctx);
    throw new Error('Unsupported pilot staff operation');
  }
  if (!ctx.client) throw new Error('Authenticated staff client required');
  const { data, error } = await ctx.client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

/** Private worker store. Never pass a browser-controlled SQL/function name. */
async function workerRPC(preview: boolean, operation: 'prepare' | 'begin' | 'finish',
  location: string, attempt?: string, result?: unknown) {
  const loc = assertUUID(location);
  if (preview) {
    if (operation === 'prepare') return localSQL(`SELECT crm_pilot_prepare('${loc}',NULL,true);`);
    const id = assertUUID(attempt!);
    if (operation === 'begin') return localSQL(`SELECT crm_pilot_begin('${id}');`);
    return localSQL(`SELECT crm_pilot_finish('${id}',${literal(result)}); SELECT true;`);
  }
  const { createServiceClient } = await import('../supabase/serviceClient');
  const args = operation === 'prepare' ? { p_location: loc, p_thread: null, p_worker: true }
    : operation === 'begin' ? { p_attempt: attempt }
    : { p_attempt: attempt, p_result: result };
  const { data, error } = await createServiceClient().rpc(`crm_pilot_${operation}`, args);
  if (error) throw new Error('Pilot worker operation unavailable');
  return data;
}

export async function drainPilotLocation(preview: boolean, location: string) {
  const loc = assertUUID(location);
  if (!preview) {
    if (process.env.CRM_PROVIDER_REHEARSAL_ENABLED !== 'staff-only') {
      return { processed: 0, evidence: 'provider pending', reason: 'Staff-only rehearsal is not enabled; queue retained' };
    }
    const { createServiceClient } = await import('../supabase/serviceClient');
    const { data: binding, error } = await createServiceClient().from('crm_locations')
      .select('credential_ref,connection').eq('location_id', loc).maybeSingle();
    if (error || binding?.connection !== 'rehearsal' ||
        !/^CRM_TWILIO_[A-Z0-9_]+$/.test(binding.credential_ref || '') ||
        !process.env[binding.credential_ref]) {
      return { processed: 0, evidence: 'provider pending', reason: 'Approved location credential is unavailable; queue retained' };
    }
  }
  const ids: string[] = await workerRPC(preview, 'prepare', loc) || [];
  let processed = 0;
  for (const id of ids) {
    // A prepared action with no request started is safe to pick up after a
    // restart. An attempting/unknown action is never returned by begin twice.
    const claim = await workerRPC(preview, 'begin', loc, id) as (PilotClaim & { simulated: boolean }) | null;
    if (!claim) continue;
    const result = preview
      ? claim.simulated ? { status: 'accepted', provider_sid: `SIM-PILOT-${id}`,
        reason: claim.kind === 'sms' ? 'Simulated provider acceptance; signed delivery evidence pending'
          : 'Simulated staff bridge; no recipient answer established' }
        : { status: 'blocked', reason: 'Preview cannot use real transport; review the isolated binding' }
      : await sendPilotClaim(claim, {
        enabled: process.env.CRM_PROVIDER_REHEARSAL_ENABLED === 'staff-only',
        credential: reference => process.env[reference],
      });
    await workerRPC(preview, 'finish', loc, id, result);
    processed++;
  }
  return { processed, evidence: preview ? 'simulated' : 'provider pending' };
}
