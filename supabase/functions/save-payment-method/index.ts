// =============================================================================
// supabase/functions/save-payment-method/index.ts
// =============================================================================
// Task #233 — In-app payment method management
//
// Auth model: Standard Supabase JWT required (parent role).
//
// Deploy with:
//   npx supabase functions deploy save-payment-method
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY              (sk_live_... or sk_test_...)
//   SUPABASE_URL                   (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY      (auto-injected)
//   SUPABASE_ANON_KEY              (auto-injected)
//
// Request body (JSON):
//   {} (empty — family and customer derived from JWT)
//
// Flow:
//   1. Authenticate caller JWT (parent only).
//   2. Load family + primary location → stripe_connected_customer_id.
//   3. List the customer's payment methods (type=card) on the connected account,
//      newest first (created desc).
//   4. Take the most recent card — this is the one just saved via PaymentSheet.
//   5. Set it as default on the customer (invoice_settings.default_payment_method).
//   6. Write the four shadow display columns to families.
//   7. Return the card details to the client for immediate UI update.
//
// Returns:
//   { card_brand, card_last4, card_exp_month, card_exp_year }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function encodeFormBody(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = encodeFormBody(v as Record<string, unknown>, key);
      if (nested) parts.push(nested);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

async function stripePost(
  path: string,
  secretKey: string,
  body: Record<string, unknown>,
  stripeAccountId?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers,
    body: encodeFormBody(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
  }
  return data;
}

async function stripeGet(
  path: string,
  secretKey: string,
  stripeAccountId?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secretKey}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'GET', headers });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: { code: 'method_not_allowed', message: 'POST only' } }, 405);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json({ error: { code: 'config_error', message: 'Stripe not configured' } }, 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verify caller JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerToken) {
    return json({ error: { code: 'unauthorized', message: 'Missing Authorization header' } }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });
  const { data: { user }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !user) {
    return json({ error: { code: 'unauthorized', message: 'Invalid token' } }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Load family + primary location
  const { data: family, error: famErr } = await supabase
    .from('families')
    .select('id, primary_location_id, stripe_connected_customer_id, stripe_customer_id')
    .eq('parent_user_id', user.id)
    .single();

  if (famErr || !family) {
    console.error('[save-payment-method] family lookup failed:', famErr?.message, 'user_id:', user.id);
    return json({ error: { code: 'family_not_found', message: 'Family record not found' } }, 404);
  }

  // Load location to determine connected vs platform account
  const { data: location } = await supabase
    .from('locations')
    .select('stripe_account_id, stripe_onboarding_status')
    .eq('id', family.primary_location_id)
    .single();

  const useConnected = !!(
    location?.stripe_account_id &&
    location?.stripe_onboarding_status === 'connected'
  );
  const connectedAccountId: string | undefined = useConnected
    ? (location!.stripe_account_id as string)
    : undefined;

  const familyAny = family as unknown as Record<string, unknown>;
  const customerId = useConnected
    ? (familyAny.stripe_connected_customer_id as string | null ?? null)
    : (familyAny.stripe_customer_id as string | null ?? null);

  if (!customerId) {
    return json({ error: { code: 'no_customer', message: 'No Stripe customer on file — complete the card setup first' } }, 422);
  }

  // List the customer's cards on the connected account, newest first
  const pmList = await stripeGet(
    `payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=10`,
    stripeKey,
    connectedAccountId,
  );

  const pmData = pmList.data as Array<Record<string, unknown>>;
  if (!pmData || pmData.length === 0) {
    return json({ error: { code: 'no_payment_method', message: 'No cards found for this customer' } }, 422);
  }

  // Sort by created desc (newest first) and take the first
  const sorted = [...pmData].sort((a, b) => (b.created as number) - (a.created as number));
  const pm = sorted[0];
  const pmId = pm.id as string;
  const card = pm.card as Record<string, unknown>;

  const cardBrand = (card.brand as string | undefined) ?? '';
  const cardLast4 = (card.last4 as string | undefined) ?? '';
  const cardExpMonth = (card.exp_month as number | undefined) ?? 0;
  const cardExpYear = (card.exp_year as number | undefined) ?? 0;

  // Normalize brand to title case (Stripe returns lowercase: "visa", "mastercard")
  const normalizedBrand = cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1);

  // Set this card as the customer's default payment method
  await stripePost(`customers/${customerId}`, stripeKey, {
    'invoice_settings[default_payment_method]': pmId,
  }, connectedAccountId);

  // Update shadow columns on families
  const { error: updateErr } = await supabase
    .from('families')
    .update({
      card_last4: cardLast4,
      card_brand: normalizedBrand,
      card_exp_month: cardExpMonth,
      card_exp_year: cardExpYear,
      updated_at: new Date().toISOString(),
    })
    .eq('id', family.id);

  if (updateErr) {
    console.error('[save-payment-method] DB update failed:', updateErr.message);
    return json({ error: { code: 'db_error', message: 'Failed to save card info' } }, 500);
  }

  console.log(`[save-payment-method] family=${family.id} pm=${pmId} brand=${normalizedBrand} last4=${cardLast4}`);

  return json({
    card_brand: normalizedBrand,
    card_last4: cardLast4,
    card_exp_month: cardExpMonth,
    card_exp_year: cardExpYear,
  });
});
