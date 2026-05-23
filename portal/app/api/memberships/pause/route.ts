/**
 * POST /api/memberships/pause
 *
 * Portal proxy to the pause-membership Edge Function.
 * Auth + tenant isolation enforced inside the Edge Function via JWT.
 *
 * Body: { membership_id: string, pause_end: string (YYYY-MM-DD) }
 * Returns: { ok: true, pause_start: string, pause_end: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return clientErr(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return clientErr(403, 'Forbidden');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return clientErr(500, 'NEXT_PUBLIC_SUPABASE_URL not configured');

  const body = await req.json().catch(() => ({})) as {
    membership_id?: string;
    pause_end?: string;
  };
  if (!body.membership_id) return clientErr(400, 'membership_id is required');
  if (!body.pause_end) return clientErr(400, 'pause_end is required');

  try {
    const fnRes = await fetch(`${supabaseUrl}/functions/v1/pause-membership`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        membership_id: body.membership_id,
        pause_end: body.pause_end,
      }),
    });

    const data = await fnRes.json() as {
      ok?: boolean;
      pause_start?: string;
      pause_end?: string;
      error?: { message?: string; code?: string };
    };

    if (!fnRes.ok || !data.ok) {
      const msg = typeof data.error === 'object'
        ? data.error?.message ?? `Error ${fnRes.status}`
        : String(data.error ?? `Error ${fnRes.status}`);
      return clientErr(fnRes.status >= 400 && fnRes.status < 500 ? fnRes.status : 500, msg);
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[memberships/pause] proxy error:', msg);
    return clientErr(500, msg);
  }
}
