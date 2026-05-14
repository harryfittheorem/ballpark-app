/**
 * GET /api/stripe/connect/callback
 *
 * Stripe OAuth callback. Verifies the signed state token, exchanges the
 * authorization code for a connected account ID, persists it to `locations`,
 * and redirects the owner back to the Payments settings page.
 *
 * Security:
 *   The `state` parameter is a signed token created by `/api/stripe/connect/start`
 *   containing {location_id, tenant_id, exp} + HMAC-SHA256.  We verify the signature
 *   and expiry before touching any database row, and double-check tenant ownership
 *   using the service-role query (checking tenant_id column on the location row).
 *   This prevents IDOR — an attacker cannot attach an arbitrary Stripe account to a
 *   location they do not own.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/serviceClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectWithError(origin: string, message: string) {
  const url = new URL('/owner/payments', origin);
  url.searchParams.set('error', encodeURIComponent(message));
  return NextResponse.redirect(url.toString());
}

function verifyAndParseState(
  state: string,
  secret: string,
): { location_id: string; tenant_id: string; exp: number } | null {
  const dotIdx = state.lastIndexOf('.');
  if (dotIdx < 0) return null;

  const payload = state.slice(0, dotIdx);
  const receivedSig = state.slice(dotIdx + 1);

  const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(receivedSig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(json) as { location_id: string; tenant_id: string; exp: number };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const stripeError = searchParams.get('error_description') ?? searchParams.get('error');

  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  if (stripeError) {
    return redirectWithError(origin, stripeError);
  }

  if (!code || !state) {
    return redirectWithError(origin, 'Missing code or state from Stripe');
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return redirectWithError(origin, 'Stripe is not configured on this server');
  }

  // Verify and parse the signed state token
  const parsed = verifyAndParseState(state, secretKey);
  if (!parsed) {
    return redirectWithError(origin, 'Invalid or tampered state parameter');
  }
  if (Date.now() > parsed.exp) {
    return redirectWithError(origin, 'OAuth session expired — please try connecting again');
  }

  const { location_id: locationId, tenant_id: tenantId } = parsed;

  // Exchange the authorization code for a connected account (single authenticated request)
  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

  let stripeAccountId: string;
  let accountName: string | null = null;
  let payoutInterval: string | null = null;

  try {
    const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
      }).toString(),
      cache: 'no-store',
    });

    const tokenData = await tokenRes.json() as {
      stripe_user_id?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.stripe_user_id) {
      const msg = tokenData.error_description ?? tokenData.error ?? 'Token exchange failed';
      return redirectWithError(origin, msg);
    }

    stripeAccountId = tokenData.stripe_user_id;

    // Fetch account details for display name and payout schedule
    const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, {
      headers: { Authorization: `Basic ${basicAuth}` },
      cache: 'no-store',
    });

    if (accountRes.ok) {
      const acctData = await accountRes.json() as {
        business_profile?: { name?: string };
        settings?: {
          dashboard?: { display_name?: string };
          payouts?: { schedule?: { interval?: string; monthly_anchor?: number; weekly_anchor?: string } };
        };
        email?: string;
      };
      accountName =
        acctData.business_profile?.name ??
        acctData.settings?.dashboard?.display_name ??
        acctData.email ??
        null;

      const schedule = acctData.settings?.payouts?.schedule;
      if (schedule?.interval) {
        if (schedule.interval === 'daily') payoutInterval = 'Daily';
        else if (schedule.interval === 'weekly') payoutInterval = `Weekly (${schedule.weekly_anchor ?? 'Friday'})`;
        else if (schedule.interval === 'monthly') payoutInterval = `Monthly (${schedule.monthly_anchor ?? 1}st)`;
        else payoutInterval = schedule.interval;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error during token exchange';
    return redirectWithError(origin, msg);
  }

  // Persist to the database — verify tenant ownership before writing
  const supabase = createServiceClient();

  const { data: locationRow } = await supabase
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!locationRow) {
    return redirectWithError(origin, 'Location not found or access denied');
  }

  const { error: dbErr } = await supabase
    .from('locations')
    .update({
      stripe_account_id: stripeAccountId,
      stripe_onboarding_status: 'pending',
      stripe_account_name: accountName,
      stripe_payout_interval: payoutInterval,
      updated_at: new Date().toISOString(),
    })
    .eq('id', locationId);

  if (dbErr) {
    return redirectWithError(origin, `Database update failed: ${dbErr.message}`);
  }

  const successUrl = new URL('/owner/payments', origin);
  successUrl.searchParams.set('connected', '1');
  return NextResponse.redirect(successUrl.toString());
}
