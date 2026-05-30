/**
 * GET /api/stripe/connect/refresh
 *
 * Stripe Account Link refresh URL — called when the onboarding link expires
 * before the user completes it. Generates a fresh Account Link and redirects
 * the user back to Stripe to continue where they left off.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_PORTAL_URL) return process.env.NEXT_PUBLIC_PORTAL_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  return `${proto}://${host}`;
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

  const fallback = new URL('/owner/payments', origin);
  fallback.searchParams.set('error', encodeURIComponent('Onboarding link expired — please try again'));

  if (!token) return NextResponse.redirect(fallback.toString());

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.redirect(fallback.toString());

  const parsed = verifyAndParseToken(token, secretKey);
  if (!parsed) return NextResponse.redirect(fallback.toString());

  const { account_id: stripeAccountId, location_id: locationId, tenant_id: tenantId } = parsed;

  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

  // Build a fresh signed token (resets the 30-min TTL)
  const STATE_TTL_MS = 30 * 60 * 1000;
  const newPayload = Buffer.from(JSON.stringify({
    location_id: locationId,
    account_id: stripeAccountId,
    tenant_id: tenantId,
    exp: Date.now() + STATE_TTL_MS,
  })).toString('base64url');
  const newSig = createHmac('sha256', secretKey).update(newPayload).digest('hex');
  const newToken = `${newPayload}.${newSig}`;

  const returnUrl  = `${origin}/api/stripe/connect/callback?token=${encodeURIComponent(newToken)}`;
  const refreshUrl = `${origin}/api/stripe/connect/refresh?token=${encodeURIComponent(newToken)}`;

  try {
    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
      },
      body: new URLSearchParams({
        account: stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      }).toString(),
      cache: 'no-store',
    });

    const linkData = await linkRes.json() as { url?: string };
    if (linkRes.ok && linkData.url) {
      return NextResponse.redirect(linkData.url);
    }
  } catch {
    // fall through to fallback
  }

  return NextResponse.redirect(fallback.toString());
}
