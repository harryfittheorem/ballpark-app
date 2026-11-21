import { crmContext } from '@/lib/crm/context';
import { pilotRPC } from '@/lib/crm/pilot';
import { assertUUID } from '@/lib/crm/local';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(req: Request, write: boolean) {
  try {
    const ctx = await crmContext(req);
    const location = assertUUID(new URL(req.url).searchParams.get('location_id') || '');
    if (!ctx.locations.some(item => item.id === location)) throw new Error('Location not authorized');
    let status;
    if (write) {
      if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) {
        return Response.json({ error: 'Origin not authorized' }, { status: 403 });
      }
      const body = await req.json();
      status = await pilotRPC(ctx, 'crm_pilot_manage', {
        p_location: location, p_action: body.action, p_payload: body.payload || {},
      });
    } else status = await pilotRPC(ctx, 'crm_pilot_status', { p_location: location });
    const blockers: string[] = [];
    if (!status.configured) blockers.push('Approved operator and staff test identities required');
    if (status.configured && !status.operator_authorized) blockers.push('Existing operator role or explicit location grant is missing');
    if (status.configured && status.active && (!status.last_worker_at ||
        Date.now() - Date.parse(status.last_worker_at) > 90000)) blockers.push('Automatic worker heartbeat is missing or stale');
    if (!ctx.preview) {
      const { createServiceClient } = await import('@/lib/supabase/serviceClient');
      const { data: binding } = await createServiceClient().from('crm_locations')
        .select('credential_ref,webhook_url').eq('location_id', location).eq('tenant_id', ctx.tenantId).maybeSingle();
      if (!binding?.credential_ref || !/^CRM_TWILIO_[A-Z0-9_]+$/.test(binding.credential_ref) ||
          !process.env[binding.credential_ref]) blockers.push('Location-owned Twilio credential is not provisioned');
      if (!binding?.webhook_url?.startsWith('https://')) blockers.push('Approved staging callback URL is missing');
      if (process.env.CRM_PROVIDER_REHEARSAL_ENABLED !== 'staff-only') blockers.push('Server-side staff-only rehearsal enablement is missing');
      if (!process.env.CRM_WORKER_SECRET) blockers.push('Protected staging worker authorization is missing');
    }
    status = { ...status, blockers, readiness: status.connection === 'missing' ? 'disconnected'
      : blockers.length ? 'blocked' : status.paused ? 'paused' : ctx.preview ? 'simulated ready' : 'ready' };
    return Response.json({ pilot: status, actor_id: ctx.userId, role: ctx.role,
      provider_verification: 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Pilot request failed';
    const safe = text.includes('ERROR:') ? text.split('ERROR:')[1].split('\n')[0].trim() : text;
    return Response.json({ error: safe.slice(0, 300) }, { status: /authorized|permission|sign-in|operator/i.test(safe) ? 403 : 409 });
  }
}
export const GET = (req: Request) => handle(req, false);
export const POST = (req: Request) => handle(req, true);
