// =============================================================================
// supabase/functions/stripe-create-payment-intent/index.ts
// =============================================================================
// Task #72 — Stripe Connect Phase 2: Card checkout for store items
//
// Auth model: Standard Supabase JWT required (parent role only).
//
// Deploy with:
//   npx supabase functions deploy stripe-create-payment-intent
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY              (sk_live_... or sk_test_...)
//   SUPABASE_URL                   (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY      (auto-injected)
//   SUPABASE_ANON_KEY              (auto-injected)
//
// Request body (JSON):
//   { product_id: string, kid_id: string }
//
// Returns:
//   { client_secret, customer_id, ephemeral_key_secret, order_id,
//     redemption_code, amount_cents }
//
// Errors:
//   422 location_not_connected  — location's Stripe account not fully set up
//   422 unavailable             — product inactive / not purchasable
//   422 sold_out                — product out of stock
//   403 forbidden               — kid does not belong to caller
//
// Design notes:
//   - REQUIRES a fully connected (charges_enabled) location Stripe account.
//     Returns 422 if the location has no connected account or is pending/restricted.
//   - Creates or reuses a Stripe Customer on the PLATFORM account for the family
//     (stored in families.stripe_customer_id), enabling payment sheet to show
//     saved cards on subsequent purchases.
//   - Generates a short-lived ephemeral key so the mobile client can present
//     the Stripe payment sheet with saved payment method support.
//   - Creates a Stripe PaymentIntent on_behalf_of the connected account with
//     application_fee_amount derived from tenant.royalty_config.
//   - Inserts an orders row with status='payment_pending'. Lifecycle:
//     payment_intent.succeeded  → 'ordered'        (inventory already reserved above)
//     payment_intent.canceled   → 'cancelled'      (inventory restored by webhook)
//     payment_intent.failed     → 'payment_failed' (inventory restored by webhook)
//     Staff QR scan             → 'fulfilled'      (mark_redemption_fulfilled RPC)
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

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

// ─── Stripe form-body encoder ─────────────────────────────────────────────────
// Recursively encodes nested objects as metadata[key]=value so Stripe's
// form-urlencoded API receives them correctly.

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

// ─── Stripe API helper ────────────────────────────────────────────────────────

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
  if (stripeAccountId) {
    headers['Stripe-Account'] = stripeAccountId;
  }

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

// ─── Redemption code generator ────────────────────────────────────────────────
// 8-char base32 (no 0/O/1/I) — matches gen_redemption_code() in SQL.

function genRedemptionCode(): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (const byte of arr) {
    code += alpha[byte % alpha.length];
  }
  return code;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: { code: 'method_not_allowed', message: 'POST only' } }, 405);
  }

  // ── Authenticate caller ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return json({ error: { code: 'unauthorized', message: 'Missing Authorization header' } }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!stripeSecretKey) {
    console.error('[stripe-create-payment-intent] STRIPE_SECRET_KEY not configured');
    return json({ error: { code: 'config_error', message: 'Payment processing not configured' } }, 500);
  }

  // Verify caller JWT to get their identity
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return json({ error: { code: 'unauthorized', message: 'Invalid token' } }, 401);
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let productId: string;
  let kidId: string;
  try {
    const body = await req.json();
    productId = body.product_id;
    kidId = body.kid_id;
    if (!productId || !kidId) throw new Error('missing fields');
  } catch {
    return json({ error: { code: 'bad_request', message: 'product_id and kid_id required' } }, 400);
  }

  // ── Service-role client for trusted DB reads/writes ──────────────────────
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Verify caller owns the kid ───────────────────────────────────────────
  const { data: kid, error: kidErr } = await supabase
    .from('kids')
    .select('id, family_id, tenant_id')
    .eq('id', kidId)
    .single();

  if (kidErr || !kid) {
    return json({ error: { code: 'not_found', message: 'Kid not found' } }, 404);
  }

  const { data: family, error: famErr } = await supabase
    .from('families')
    .select('id, tenant_id, parent_user_id, primary_location_id, stripe_customer_id')
    .eq('id', kid.family_id)
    .single();

  if (famErr || !family) {
    return json({ error: { code: 'not_found', message: 'Family not found' } }, 404);
  }

  if (family.parent_user_id !== user.id) {
    return json({ error: { code: 'forbidden', message: 'Kid does not belong to caller' } }, 403);
  }

  // ── Load product ─────────────────────────────────────────────────────────
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, name, dollar_price_cents, is_purchasable, is_active, inventory_count')
    .eq('id', productId)
    .eq('tenant_id', kid.tenant_id)
    .single();

  if (prodErr || !product) {
    return json({ error: { code: 'not_found', message: 'Product not found' } }, 404);
  }
  if (!product.is_active) {
    return json({ error: { code: 'unavailable', message: 'Product is not available' } }, 422);
  }
  if (!product.is_purchasable || product.dollar_price_cents === null) {
    return json({ error: { code: 'unavailable', message: 'Product cannot be purchased with a card' } }, 422);
  }
  // Non-atomic sold-out guard: quick pre-check to return a fast 422 before
  // attempting the atomic reserve below. Not the definitive check — the
  // reserve_product_inventory RPC is authoritative.
  if (product.inventory_count !== null && product.inventory_count <= 0) {
    return json({ error: { code: 'sold_out', message: 'Product is sold out' } }, 422);
  }

  // ── REQUIRE connected Stripe account ─────────────────────────────────────
  // Card payments MUST route through the location's connected Stripe account.
  // If the location has not completed onboarding, reject the request clearly.
  const locationId = family.primary_location_id;
  let stripeAccountId: string | null = null;

  if (locationId) {
    const { data: location } = await supabase
      .from('locations')
      .select('stripe_account_id, stripe_onboarding_status')
      .eq('id', locationId)
      .single();

    const loc = location as { stripe_account_id?: string | null; stripe_onboarding_status?: string | null } | null;
    if (loc?.stripe_onboarding_status === 'connected' && loc?.stripe_account_id) {
      stripeAccountId = loc.stripe_account_id;
    }
  }

  if (!stripeAccountId) {
    return json({
      error: {
        code: 'location_not_connected',
        message: 'Card payments are not yet available at this location. Please pay at the front desk or check back later.',
      },
    }, 422);
  }

  // ── Load tenant royalty config ────────────────────────────────────────────
  const { data: tenant } = await supabase
    .from('tenants')
    .select('royalty_config')
    .eq('id', kid.tenant_id)
    .single();

  const royaltyRate = (tenant?.royalty_config as { rate?: number } | null)?.rate ?? 0.025;
  const amountCents = product.dollar_price_cents;
  const applicationFeeCents = Math.round(amountCents * royaltyRate);

  // ── Create or retrieve Stripe Customer on the PLATFORM account ───────────
  // Customers live on the platform account (no Stripe-Account header) and are
  // reused across purchases. The customer_id is stored in families.stripe_customer_id.
  let customerId: string = family.stripe_customer_id ?? '';

  if (!customerId) {
    try {
      const customer = await stripePost('customers', stripeSecretKey, {
        description: `Ballpark family ${family.id}`,
        metadata: {
          family_id: family.id,
          tenant_id: kid.tenant_id,
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id as string;

      // Persist so we reuse the same Customer on future purchases
      await supabase
        .from('families')
        .update({ stripe_customer_id: customerId })
        .eq('id', family.id);
    } catch (err) {
      console.error('[stripe-create-payment-intent] Customer create error:', err);
      return json({ error: { code: 'stripe_error', message: 'Could not set up payment customer' } }, 502);
    }
  }

  // ── Generate ephemeral key for the customer ───────────────────────────────
  // Ephemeral keys allow the mobile client to present the Stripe payment sheet
  // with saved payment methods. The key is short-lived (max 24 hours).
  let ephemeralKeySecret: string;
  try {
    const ek = await stripePost('ephemeral_keys', stripeSecretKey, {
      customer: customerId,
    });
    ephemeralKeySecret = ek.secret as string;
  } catch (err) {
    console.error('[stripe-create-payment-intent] Ephemeral key error:', err);
    return json({ error: { code: 'stripe_error', message: 'Could not create payment session' } }, 502);
  }

  // ── Generate redemption code ──────────────────────────────────────────────
  let redemptionCode = genRedemptionCode();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('redemption_code', redemptionCode)
      .maybeSingle();
    if (!existing) break;
    redemptionCode = genRedemptionCode();
  }

  // ── Atomically reserve inventory BEFORE creating the Stripe PaymentIntent ──
  // This is the authoritative sold-out check. reserve_product_inventory
  // does a conditional UPDATE WHERE inventory_count > 0 and returns:
  //   TRUE  = reserved successfully (or unlimited stock, no decrement needed)
  //   FALSE = sold out (another buyer just took the last unit)
  // By reserving here (before Stripe is called), we prevent the race where
  // two parents both successfully pay for the last unit.
  const { data: reserved, error: reserveErr } = await supabase.rpc(
    'reserve_product_inventory',
    { p_product_id: productId },
  );
  if (reserveErr) {
    console.error('[stripe-create-payment-intent] reserve_product_inventory error:', reserveErr.message);
    return json({ error: { code: 'db_error', message: 'Could not reserve product' } }, 500);
  }
  if (!reserved) {
    return json({ error: { code: 'sold_out', message: 'Product is sold out' } }, 422);
  }

  // ── Create Stripe PaymentIntent on_behalf_of the connected account ────────
  let paymentIntentId: string;
  let clientSecret: string;

  try {
    const pi = await stripePost('payment_intents', stripeSecretKey, {
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: 'true' },
      application_fee_amount: applicationFeeCents,
      on_behalf_of: stripeAccountId,
      transfer_data: { destination: stripeAccountId },
      metadata: {
        product_id: productId,
        kid_id: kidId,
        family_id: family.id,
        tenant_id: kid.tenant_id,
        redemption_code: redemptionCode,
      },
    });
    paymentIntentId = pi.id as string;
    clientSecret = pi.client_secret as string;
  } catch (err) {
    console.error('[stripe-create-payment-intent] PaymentIntent error:', err);
    // Restore the inventory reservation — the Stripe PI was never created
    await supabase.rpc('restore_product_inventory', { p_product_id: productId }).catch((e: unknown) => {
      console.error('[stripe-create-payment-intent] restore_product_inventory (PI create failure):', e);
    });
    return json({
      error: {
        code: 'stripe_error',
        message: err instanceof Error ? err.message : 'Could not create payment',
      },
    }, 502);
  }

  // ── Insert order row with status='payment_pending' ────────────────────────
  // Status transitions via webhook:
  //   payment_intent.succeeded      → 'ordered'       (payment confirmed; inventory already reserved above)
  //                                    Then: staff QR scan → 'fulfilled' (mark_redemption_fulfilled RPC)
  //   payment_intent.payment_failed → 'payment_failed'
  //   payment_intent.canceled       → 'cancelled'
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      tenant_id: kid.tenant_id,
      family_id: family.id,
      kid_id: kidId,
      product_id: productId,
      payment_method: 'card',
      amount_paid_cents: amountCents,
      stripe_payment_intent_id: paymentIntentId,
      status: 'payment_pending',
      redemption_code: redemptionCode,
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    console.error('[stripe-create-payment-intent] Order insert failed:', orderErr?.message);
    // Cancel the PI to avoid an orphaned charge, and restore the inventory
    // reservation since no order was created to track this purchase.
    await Promise.allSettled([
      stripePost(`payment_intents/${paymentIntentId}/cancel`, stripeSecretKey, {
        cancellation_reason: 'duplicate',
      }),
      supabase.rpc('restore_product_inventory', { p_product_id: productId }),
    ]);
    return json({ error: { code: 'db_error', message: 'Could not create order' } }, 500);
  }

  console.log(
    `[stripe-create-payment-intent] order=${order.id} pi=${paymentIntentId}` +
    ` amount=${amountCents} fee=${applicationFeeCents} acct=${stripeAccountId}`,
  );

  return json({
    client_secret: clientSecret,
    customer_id: customerId,
    ephemeral_key_secret: ephemeralKeySecret,
    order_id: order.id,
    redemption_code: redemptionCode,
    amount_cents: amountCents,
  });
});
