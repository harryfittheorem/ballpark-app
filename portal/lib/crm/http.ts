import type { SupabaseClient } from '@supabase/supabase-js';
import type { CRMCommand } from './types';
import { localExecute, localSnapshot, localSQL } from './local';
import { controlledInquiryModel, runAssistant } from './engine';

export type CRMContext = { preview: boolean; userId: string; role: string; tenantId: string; locations: { id: string; name: string }[]; client?: SupabaseClient };
export function makeCRMHandlers(resolve: (req: Request) => Promise<CRMContext>) {
  async function handle(req: Request, write: boolean) {
    let authorized: CRMContext | undefined;
    let authorizedLocation: string | undefined;
    try {
      const ctx = await resolve(req);
      const url = new URL(req.url);
      const body = write ? await req.json() : null;
      const location = body?.location_id || url.searchParams.get('location_id') || ctx.locations[0]?.id;
      if (!ctx.locations.some(l => l.id === location)) return Response.json({ error: 'Location not authorized' }, { status: 403 });
      authorized = ctx;
      authorizedLocation = location;
      const command = body?.command as CRMCommand | undefined;
      if (write && (!command || typeof command.kind !== 'string' || typeof command.key !== 'string')) return Response.json({ error: 'Invalid CRM action' }, { status: 400 });
      let state;
      if (ctx.preview) {
        if (command?.kind === 'preview_inbound') {
          const current = await localSnapshot(location, ctx);
          const thread = current.threads.find(t => t.id === command.thread_id);
          if (!thread) throw new Error('Conversation not found');
          // Same signed webhook validator and provider application service as
          // actual callbacks, using a non-delivering server-only signer.
          const { syntheticInbound } = await import('./provider');
          await syntheticInbound(location, thread.phone, command.text || '', command.key);
          state = await localSnapshot(location, ctx);
        } else if (command?.kind === 'assist') {
          const current = await localSnapshot(location, ctx);
          if (!command.thread_id) throw new Error('Conversation required');
          state = await runAssistant(current, command.thread_id, command.key, controlledInquiryModel,
            c => localExecute(location, c, ctx));
        } else if (command?.kind === 'reevaluate') {
          const { assertUUID } = await import('./local');
          await localSQL(`SELECT crm_reevaluate('${location}',${command.task_id ? `'${assertUUID(command.task_id)}'` : 'NULL'});`,ctx);
          state = await localSnapshot(location,ctx);
        } else {
          state = command ? await localExecute(location, command, ctx) : await localSnapshot(location, ctx);
        }
      } else {
        if (!ctx.client) throw new Error('Authenticated client missing');
        if(command?.kind === 'reevaluate') {
          const {error:taskError}=await ctx.client.rpc('crm_reevaluate',{p_location:location,p_complete:command.task_id||null});
          if(taskError)throw new Error(taskError.message);
        }
        const { data, error } = command && command.kind !== 'reevaluate'
          ? await ctx.client.rpc('crm_execute', { p_location: location, p_command: command })
          : await ctx.client.rpc('crm_snapshot', { p_location: location });
        if (error) throw new Error(error.message.includes('does not exist') || error.code === 'PGRST202' ? 'CRM migration is not applied. Use the isolated rehearsal; no shared database changes were made.' : error.message);
        state = data;
      }
      return Response.json({ state, locations: ctx.locations, location_id: location }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      // psql stderr may include SQL. Return only the PostgreSQL message.
      const message = error instanceof Error ? error.message : 'CRM request failed';
      const safe = message.includes('ERROR:') ? message.split('ERROR:')[1].split('\n')[0].trim() : message;
      let state;
      if (authorized && authorizedLocation && /no longer available|slot_not_available|resource_not_available|Conversation changed/.test(safe)) {
        try {
          state = authorized.preview ? await localSnapshot(authorizedLocation, authorized)
            : (await authorized.client!.rpc('crm_snapshot', { p_location: authorizedLocation })).data;
        } catch { /* Preserve the explicit conflict if availability is unavailable. */ }
      }
      return Response.json({ error: safe.slice(0, 350), ...(state ? { state } : {}) },
        { status: /sign-in|authorized|denied/i.test(safe) ? 403 : 409, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  return { GET: (req: Request) => handle(req, false), POST: (req: Request) => handle(req, true) };
}
