/**
 * POST /api/stripe/subscription/cancel
 *
 * Thin portal proxy to the stripe-cancel-subscription Edge Function.
 * Auth + tenant isolation are enforced inside the Edge Function via JWT.
 * All Stripe logic (cancel_at_period_end, resource_missing cleanup, DB update)
 * lives exclusively in the Edge Function — a single cancellation implementation.
 *
 * Request body:
 *   { membership_id: string }
 *
 * Returns:
 *   { ok: true, cancel_at_period_end: boolean, cancel_at?: string }
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

  const body = await req.json().catch(() => ({})) as { membership_id?: string };
  if (!body.membership_id) return clientErr(400, 'membership_id is required');

  // Proxy to the stripe-cancel-subscription Edge Function.
  // The Edge Function enforces role + tenant isolation from the caller's JWT,
  // handles the no-subscription case (immediate DB cancel), calls Stripe with
  // the correct connected-account header, and cleans up on resource_missing.
  try {
    const fnRes = await fetch(`${supabaseUrl}/functions/v1/stripe-cancel-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ membership_id: body.membership_id }),
    });

    const data = await fnRes.json() as {
      ok?: boolean;
      cancel_at_period_end?: boolean;
      cancel_at?: string;
      cancelled_immediately?: boolean;
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
    console.error('[stripe/subscription/cancel] proxy error:', msg);
    return clientErr(500, msg);
  }
}
