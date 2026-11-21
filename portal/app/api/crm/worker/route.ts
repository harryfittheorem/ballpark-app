import { timingSafeEqual } from 'node:crypto';
import { drainPilotLocation } from '@/lib/crm/pilot';
import { localSigner } from '@/lib/crm/provider';
import { assertUUID, previewReady } from '@/lib/crm/local';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const preview = new URL(req.url).searchParams.get('preview') === '1';
  const expected = preview && previewReady() ? await localSigner()
    : !preview ? process.env.CRM_WORKER_SECRET : undefined;
  const supplied = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return Response.json({ error: 'Worker authorization required' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const result = await drainPilotLocation(preview, assertUUID(body.location_id));
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Do not print SQL, request bodies, auth headers or contact identities.
    return Response.json({ error: 'Pilot queue unavailable; durable attempts retained' }, { status: 503 });
  }
}
