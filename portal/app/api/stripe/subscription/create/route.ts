/**
 * POST /api/stripe/subscription/create
 *
 * Admin/owner-only route that activates a Stripe Subscription for an EFT
 * membership. Proxies to the stripe-create-subscription edge function using
 * the caller's session token so tenant isolation is enforced end-to-end.
 *
 * Request body:
 *   { membership_id: string }
 *
 * Returns (from edge function):
 *   { subscription_id, status, current_period_end, next_billing_at }
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

  const body = await req.json().catch(() => ({})) as { membership_id?: string };
  const { membership_id } = body;
  if (!membership_id) return clientErr(400, 'membership_id is required');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) return clientErr(500, 'Supabase URL not configured');

  // Forward the caller's session token so the edge function can enforce
  // role + tenant isolation from the JWT (same pattern as cancel route).
  const res = await fetch(`${supabaseUrl}/functions/v1/stripe-create-subscription`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ membership_id }),
  });

  const data = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    const msg = (data.error as { message?: string } | null)?.message
      ?? data.error
      ?? `Edge function error ${res.status}`;
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  return NextResponse.json(data);
}
