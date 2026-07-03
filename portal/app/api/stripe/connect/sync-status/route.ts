/**
 * POST /api/stripe/connect/sync-status
 *
 * Force-refreshes a location's Stripe onboarding status by fetching the live
 * account state directly from Stripe. Useful when a webhook was missed or in
 * sandbox/test mode where webhooks may not fire reliably.
 *
 * Security: owner/admin only; verifies location belongs to the caller's tenant.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function deriveOnboardingStatus(account: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: { disabled_reason?: string | null };
}): 'pending' | 'connected' | 'restricted' {
  if (account.charges_enabled && account.payouts_enabled) return 'connected';
  if (account.requirements?.disabled_reason) return 'restricted';
  return 'pending';
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  const body = await req.json().catch(() => ({})) as { location_id?: string };
  const locationId = body.location_id as string | undefined;
  if (!locationId) return err(400, 'location_id is required');

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return err(500, 'Stripe is not configured on this server');

  // Verify the location belongs to the authenticated user's tenant
  const svc = createServiceClient();
  const { data: location, error: locErr } = await svc
    .from('locations')
    .select('id, stripe_account_id')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .single();

  if (locErr || !location) return err(404, 'Location not found or access denied');

  const stripeAccountId = location.stripe_account_id as string | null;
  if (!stripeAccountId) return err(400, 'This location has no Stripe account connected');

  // Fetch live account state from Stripe
  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');
  const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Stripe-Version': '2024-06-20',
    },
    cache: 'no-store',
  });

  if (!accountRes.ok) {
    const errData = await accountRes.json().catch(() => ({})) as {
      error?: { message?: string; code?: string; type?: string };
    };
    const stripeCode = errData.error?.code ?? '';
    const stripeType = errData.error?.type ?? '';

    // Map well-known Stripe failures to owner-friendly messages
    if (
      accountRes.status === 404 ||
      stripeCode === 'resource_missing' ||
      stripeCode === 'account_invalid'
    ) {
      return NextResponse.json(
        {
          error: 'This Stripe account no longer exists or has been deauthorized. Disconnect this location and reconnect to link a new Stripe account.',
          error_type: 'account_not_found',
        },
        { status: 502 },
      );
    }

    if (
      accountRes.status === 401 ||
      stripeType === 'authentication_error' ||
      stripeCode === 'api_key_invalid' ||
      stripeCode === 'api_key_expired'
    ) {
      return NextResponse.json(
        {
          error: 'Stripe rejected the API key configured for this server. Please contact support to reconfigure Stripe for your account.',
          error_type: 'auth_error',
        },
        { status: 502 },
      );
    }

    // Generic fallback — still friendlier than a raw Stripe message
    return NextResponse.json(
      {
        error: 'Unable to reach Stripe right now. Please try again in a moment. If the problem persists, contact support.',
        error_type: 'stripe_error',
      },
      { status: 502 },
    );
  }

  const acctData = await accountRes.json() as {
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    business_profile?: { name?: string };
    settings?: {
      dashboard?: { display_name?: string };
      payouts?: { schedule?: { interval?: string; monthly_anchor?: number; weekly_anchor?: string } };
    };
    email?: string;
    requirements?: { disabled_reason?: string | null };
  };

  const newStatus = deriveOnboardingStatus(acctData);

  const accountName =
    acctData.business_profile?.name ??
    acctData.settings?.dashboard?.display_name ??
    acctData.email ??
    null;

  let payoutInterval: string | null = null;
  const schedule = acctData.settings?.payouts?.schedule;
  if (schedule?.interval) {
    if (schedule.interval === 'daily') payoutInterval = 'Daily';
    else if (schedule.interval === 'weekly') payoutInterval = `Weekly (${schedule.weekly_anchor ?? 'Friday'})`;
    else if (schedule.interval === 'monthly') payoutInterval = `Monthly (${schedule.monthly_anchor ?? 1}st)`;
    else payoutInterval = schedule.interval;
  }

  const updates: Record<string, string | null> = {
    stripe_onboarding_status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (accountName) updates.stripe_account_name = accountName;
  if (payoutInterval) updates.stripe_payout_interval = payoutInterval;

  const { error: dbErr } = await svc
    .from('locations')
    .update(updates)
    .eq('id', locationId);

  if (dbErr) return err(500, `Database update failed: ${dbErr.message}`);

  return NextResponse.json({ ok: true, status: newStatus });
}
