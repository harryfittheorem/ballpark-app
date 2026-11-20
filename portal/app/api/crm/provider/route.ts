import { processProviderRequest } from '@/lib/crm/provider';
import { previewReady } from '@/lib/crm/local';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const preview = new URL(req.url).searchParams.get('preview') === '1';
    if (preview && !previewReady()) return Response.json({ error: 'Rehearsal unavailable' }, { status: 403 });
    return await processProviderRequest(req, preview);
  } catch {
    return Response.json({ error: 'Provider event failed; not acknowledged' }, { status: 409 });
  }
}
