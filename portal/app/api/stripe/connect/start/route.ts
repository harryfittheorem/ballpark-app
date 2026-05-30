/**
 * POST /api/stripe/connect/start
 *
 * Creates (or reuses) a Stripe Express connected account for a location,
 * then generates an Account Link URL for hosted onboarding.
 *
 * Uses the Account Links flow (not the legacy OAuth flow) so no
 * STRIPE_CONNECT_CLIENT_ID is required.
 *
 * Security: the return_url carries a signed token
 *   base64url({location_id, account_id, tenant_id, exp}) + "." + HMAC-SHA256
 * so the callback can verify which tenant/location initiated the flow
 * without trusting raw query params.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_PORTAL_URL) return process.env.NEXT_PUBLIC_PORTAL_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url');
}

function signToken(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return clientErr(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return clientErr(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return clientErr(401, 'No tenant in session');

  const body = await req.json().catch(() => ({})) as { location_id?: string };
  const locationId = body.location_id as string | undefined;
  if (!locationId) return clientErr(400, 'location_id is required');

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return clientErr(500, 'STRIPE_SECRET_KEY is not configured');

  const origin = getOrigin(req);

  // Verify the location belongs to the authenticated user's tenant
  const svc = createServiceClient();
  const { data: location } = await svc
    .from('locations')
    .select('id, stripe_account_id')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!location) return clientErr(404, 'Location not found or access denied');

  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');
  const stripeHeaders = {
    Authorization: `Basic ${basicAuth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': '2024-06-20',
  };

  // Reuse existing account or create a new Express account
  let stripeAccountId = location.stripe_account_id as string | null;

  if (!stripeAccountId) {
    const createRes = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: stripeHeaders,
      body: new URLSearchParams({ type: 'express' }).toString(),
      cache: 'no-store',
    });

    const createData = await createRes.json() as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createData.id) {
      const msg = createData.error?.message ?? 'Failed to create Stripe account';
      return clientErr(502, msg);
    }

    stripeAccountId = createData.id;

    // Persist the new account ID immediately so refresh flows reuse it
    await svc
      .from('locations')
      .update({
        stripe_account_id: stripeAccountId,
        stripe_onboarding_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', locationId);
  }

  // Build a signed return token for the callback
  const payload = b64url(JSON.stringify({
    location_id: locationId,
    account_id: stripeAccountId,
    tenant_id: tenantId,
    exp: Date.now() + STATE_TTL_MS,
  }));
  const sig = signToken(payload, secretKey);
  const token = `${payload}.${sig}`;

  const returnUrl  = `${origin}/api/stripe/connect/callback?token=${encodeURIComponent(token)}`;
  const refreshUrl = `${origin}/api/stripe/connect/refresh?token=${encodeURIComponent(token)}`;

  // Create the Account Link for hosted onboarding
  const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
    method: 'POST',
    headers: stripeHeaders,
    body: new URLSearchParams({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    }).toString(),
    cache: 'no-store',
  });

  const linkData = await linkRes.json() as { url?: string; error?: { message?: string } };
  if (!linkRes.ok || !linkData.url) {
    const msg = linkData.error?.message ?? 'Failed to create onboarding link';
    return clientErr(502, msg);
  }

  return NextResponse.json({ url: linkData.url });
}
