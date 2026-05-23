/**
 * POST /api/bookings/cancel
 *
 * Staff override: cancel a booking bypassing the cancellation-window policy.
 * Uses the cancel_booking SECURITY DEFINER RPC with p_override=true.
 *
 * Auth: owner or admin role required.
 *
 * Request body:
 *   { booking_id: string, reason?: string }
 *
 * Returns:
 *   { ok: true }
 *   { error: string }
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

  const body = await req.json().catch(() => ({})) as {
    booking_id?: string;
    reason?: string;
  };
  if (!body.booking_id) return clientErr(400, 'booking_id is required');

  const { data, error } = await (
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient
  ).rpc('cancel_booking', {
    p_booking_id: body.booking_id,
    p_reason: body.reason ?? null,
    p_override: true,
  });

  if (error) {
    console.error('[bookings/cancel] RPC error:', error.message);
    return clientErr(500, error.message);
  }

  const result = data as { ok?: boolean; code?: string; message?: string };
  if (result.code && result.code !== undefined) {
    return clientErr(400, result.message ?? result.code);
  }

  return NextResponse.json({ ok: true });
}
