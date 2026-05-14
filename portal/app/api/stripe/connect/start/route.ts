/**
 * POST /api/stripe/connect/start
 *
 * Generates a Stripe Connect OAuth URL for Express account onboarding.
 * Returns the URL to the client so it can be opened in a new tab.
 *
 * The `state` parameter passed to Stripe is a signed token:
 *   base64url({location_id, tenant_id, exp}) + "." + HMAC-SHA256(payload, STRIPE_SECRET_KEY)
 *
 * This prevents IDOR: the callback verifies the signature and checks that
 * the location_id belongs to the tenant_id in the signed payload before
 * writing anything to the database.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url');
}

function signState(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
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

  // Verify the location belongs to the authenticated user's tenant
  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .single();

  if (locErr || !location) return clientErr(404, 'Location not found or access denied');

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? '';

  if (!clientId) return clientErr(500, 'STRIPE_CONNECT_CLIENT_ID is not configured');
  if (!secretKey) return clientErr(500, 'STRIPE_SECRET_KEY is not configured');

  // Build a signed state token so the callback can verify which tenant/location
  // initiated the flow without trusting the raw state value.
  const payload = b64url(JSON.stringify({ location_id: locationId, tenant_id: tenantId, exp: Date.now() + STATE_TTL_MS }));
  const sig = signState(payload, secretKey);
  const signedState = `${payload}.${sig}`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    state: signedState,
    redirect_uri: `${origin}/api/stripe/connect/callback`,
  });

  const stripeOAuthUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

  return NextResponse.json({ url: stripeOAuthUrl });
}
