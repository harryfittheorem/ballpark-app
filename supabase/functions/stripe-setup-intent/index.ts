// =============================================================================
// supabase/functions/stripe-setup-intent/index.ts
// =============================================================================
// Task #189 — Stripe Connect Phase 3: Payment method capture for subscriptions
//
// Auth model: Standard Supabase JWT required (parent role).
//
// Deploy with:
//   npx supabase functions deploy stripe-setup-intent
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY              (sk_live_... or sk_test_...)
//   SUPABASE_URL                   (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY      (auto-injected)
//
// Request body (JSON):
//   {} (empty — family derived from JWT)
//
// Returns:
//   { setup_intent_client_secret, customer_id, ephemeral_key_secret }
//
// Design notes:
//   - Creates or reuses a Stripe Customer on the location's connected account.
//     Customer ID is stored in families.stripe_customer_id for reuse.
//   - Returns a SetupIntent client secret + ephemeral key so the mobile client
//     can present stripe-react-native's initPaymentSheet to save the card.
//   - The saved payment method is then usable by stripe-create-subscription.
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

  // Look up the family + location
  const { data: family, error: famErr } = await supabase
    .from('families')
    .select('id, parent_first_name, parent_last_name, parent_email, stripe_connected_customer_id, primary_location_id')
    .eq('parent_user_id', user.id)
    .single();

  if (famErr || !family) {
    return json({ error: { code: 'family_not_found', message: 'Family record not found' } }, 404);
  }

  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('id, stripe_account_id, stripe_onboarding_status')
    .eq('id', family.primary_location_id)
    .single();

  if (locErr || !location || !location.stripe_account_id) {
    return json({ error: { code: 'location_not_connected', message: 'Location Stripe account not configured' } }, 422);
  }

  if (location.stripe_onboarding_status !== 'connected') {
    return json({ error: { code: 'location_not_connected', message: 'Location Stripe account not fully set up' } }, 422);
  }

  const connectedAccountId = location.stripe_account_id as string;

  // Create or reuse Stripe Customer on the CONNECTED account.
  // Stored in families.stripe_connected_customer_id (separate from
  // families.stripe_customer_id which is the PLATFORM-account customer used by
  // stripe-create-payment-intent for store checkout). Keeping them separate
  // prevents "No such customer" errors when a connected-account customer ID is
  // sent without a Stripe-Account header.
  let customerId = (family as unknown as Record<string, unknown>).stripe_connected_customer_id as string | null ?? null;

  if (customerId) {
    // Verify the customer still exists on the connected account
    try {
      await stripeGet(`customers/${customerId}`, stripeKey, connectedAccountId);
    } catch {
      customerId = null; // Customer doesn't exist on this account, create fresh
    }
  }

  if (!customerId) {
    const parentName = [family.parent_first_name, family.parent_last_name].filter(Boolean).join(' ');
    const customer = await stripePost('customers', stripeKey, {
      name: parentName || undefined,
      email: family.parent_email || undefined,
      metadata: { family_id: family.id },
    }, connectedAccountId);

    customerId = customer.id as string;

    // Persist the connected-account customer ID
    await supabase
      .from('families')
      .update({ stripe_connected_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', family.id);
  }

  // Create ephemeral key for the payment sheet
  const ephemeralKey = await stripePost('ephemeral_keys', stripeKey, {
    customer: customerId,
  }, connectedAccountId);

  // Create SetupIntent
  const setupIntent = await stripePost('setup_intents', stripeKey, {
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: { family_id: family.id },
  }, connectedAccountId);

  console.log(`[stripe-setup-intent] family=${family.id} customer=${customerId} si=${setupIntent.id}`);

  return json({
    setup_intent_client_secret: setupIntent.client_secret,
    customer_id: customerId,
    ephemeral_key_secret: (ephemeralKey.secret as string),
    stripe_account_id: connectedAccountId,
  });
});
