/**
 * GET /api/stripe/connect/callback
 *
 * Stripe Account Link return URL. Verifies the signed token, fetches the
 * connected account details, persists them to `locations`, and redirects
 * the owner back to the Payments settings page.
 *
 * Security: the token in the query string is
 *   base64url({location_id, account_id, tenant_id, exp}) + "." + HMAC-SHA256
 * created by /api/stripe/connect/start. We verify signature + expiry before
 * touching any database row, and double-check tenant ownership.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/serviceClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_PORTAL_URL) return process.env.NEXT_PUBLIC_PORTAL_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

function redirectWithError(origin: string, message: string) {
  const url = new URL('/owner/payments', origin);
  url.searchParams.set('error', encodeURIComponent(message));
  return NextResponse.redirect(url.toString());
}

function verifyAndParseToken(
  token: string,
  secret: string,
): { location_id: string; account_id: string; tenant_id: string; exp: number } | null {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 0) return null;

  const payload = token.slice(0, dotIdx);
  const receivedSig = token.slice(dotIdx + 1);
  const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    const a = Buffer.from(receivedSig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(json) as { location_id: string; account_id: string; tenant_id: string; exp: number };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const origin = getOrigin(req);

  if (!token) {
    return redirectWithError(origin, 'Missing token parameter');
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return redirectWithError(origin, 'Stripe is not configured on this server');
  }

  const parsed = verifyAndParseToken(token, secretKey);
  if (!parsed) {
    return redirectWithError(origin, 'Invalid or tampered token');
  }
  if (Date.now() > parsed.exp) {
    return redirectWithError(origin, 'Session expired — please try connecting again');
  }

  const { location_id: locationId, account_id: stripeAccountId, tenant_id: tenantId } = parsed;

  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

  // Fetch account details for display name and payout schedule
  let accountName: string | null = null;
  let payoutInterval: string | null = null;

  try {
    const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Stripe-Version': '2024-06-20',
      },
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
  } catch {
    // Best-effort — continue even if account fetch fails
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
