/**
 * GET /api/stripe/mrr
 *
 * Owner/admin-only route that returns live MRR data from Stripe Subscriptions
 * on the tenant's connected account(s). Falls back gracefully to 0 if Stripe
 * is not configured.
 *
 * Fetching logic is shared with portal/app/owner/billing/page.tsx via
 * portal/lib/stripe/mrrUtils.ts — single source of truth.
 *
 * Returns:
 *   { mrr_cents: number, active_subscription_count: number, source: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { fetchLocationMrr } from '@/lib/stripe/mrrUtils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  void req;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return clientErr(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return clientErr(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return clientErr(401, 'No tenant in session');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ mrr_cents: 0, active_subscription_count: 0, source: 'no_stripe_key' });
  }

  // Load the tenant's connected locations
  const { data: locations } = await supabase
    .from('locations')
    .select('stripe_account_id, stripe_onboarding_status')
    .eq('tenant_id', tenantId)
    .eq('stripe_onboarding_status', 'connected');

  if (!locations || locations.length === 0) {
    return NextResponse.json({ mrr_cents: 0, active_subscription_count: 0, source: 'no_connected_account' });
  }

  let totalMrrCents = 0;
  let totalActiveCount = 0;

  // Fetch MRR in parallel across all connected locations using shared utility.
  // Partial failures are tolerated — we sum up the accounts that succeed.
  const results = await Promise.allSettled(
    locations
      .filter(l => l.stripe_account_id)
      .map(l => fetchLocationMrr(stripeKey, l.stripe_account_id as string)),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalMrrCents += r.value.mrrCents;
      totalActiveCount += r.value.activeCount;
    } else {
      console.error('[stripe/mrr] Failed to fetch from one connected account:', r.reason);
    }
  }

  return NextResponse.json({
    mrr_cents: totalMrrCents,
    active_subscription_count: totalActiveCount,
    source: 'stripe_live',
  });
}
