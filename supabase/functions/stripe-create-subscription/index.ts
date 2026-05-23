// =============================================================================
// supabase/functions/stripe-create-subscription/index.ts
// =============================================================================
// Task #189 — Stripe Connect Phase 3: Create recurring membership subscription
//
// Auth model: Standard Supabase JWT required (admin or owner role only).
// Tenant isolation: caller's tenant_id (from JWT app_metadata) must match
// the target membership's tenant_id. Service-role queries are scoped by both
// membership_id AND tenant_id — a privileged user from Tenant B cannot act on
// Tenant A's memberships even if they obtain a membership UUID.
//
// Deploy with:
//   npx supabase functions deploy stripe-create-subscription
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY              (sk_live_... or sk_test_...)
//   SUPABASE_URL                   (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY      (auto-injected)
//   SUPABASE_ANON_KEY              (auto-injected)
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

  // ── Auth: verify caller JWT, role, and tenant ──────────────────────────────
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

  // Only admin/owner may create subscriptions
  const userRole = (user.app_metadata?.app_role as string | undefined)
    ?? (user.user_metadata?.app_role as string | undefined)
    ?? '';
  if (userRole !== 'admin' && userRole !== 'owner') {
    return json({ error: { code: 'forbidden', message: 'Admin or owner role required' } }, 403);
  }

  // Tenant isolation: get the caller's tenant from JWT
  const callerTenantId = (user.app_metadata?.tenant_id as string | undefined) ?? '';
  if (!callerTenantId) {
    return json({ error: { code: 'forbidden', message: 'No tenant in token — re-authenticate' } }, 403);
  }

  let body: { membership_id?: string; stripe_promotion_code_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: { code: 'bad_json', message: 'Invalid request body' } }, 400);
  }

  const { membership_id, stripe_promotion_code_id } = body;
  if (!membership_id) {
    return json({ error: { code: 'missing_param', message: 'membership_id required' } }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Load membership + family + location + tenant.
  // The query is scoped to BOTH membership_id AND the caller's tenant_id,
  // ensuring a user from Tenant B cannot act on Tenant A's memberships.
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select(`
      id, plan_name, plan_type, status, amount_cents, billing_anchor_day,
      stripe_subscription_id, stripe_price_id, tenant_id, family_id, kid_id,
      families!inner(id, stripe_connected_customer_id, primary_location_id),
      kids!inner(first_name, last_name)
    `)
    .eq('id', membership_id)
    .eq('tenant_id', callerTenantId)
    .single();

  if (memErr || !mem) {
    return json({ error: { code: 'not_found', message: 'Membership not found or access denied' } }, 404);
  }

  // Only EFT memberships get subscriptions
  if (mem.plan_type !== 'eft') {
    return json({ error: { code: 'not_applicable', message: 'Subscriptions only apply to EFT memberships' } }, 422);
  }

  // stripe_connected_customer_id is the connected-account customer (separate from
  // stripe_customer_id which is the platform-account customer for store checkout).
  const fam = mem.families as unknown as { id: string; stripe_connected_customer_id: string | null; primary_location_id: string };
  const kid = mem.kids as unknown as { first_name: string; last_name: string | null };

  if (!fam.stripe_connected_customer_id) {
    return json({ error: { code: 'no_payment_method', message: 'Family has no saved payment method on the connected account. Use stripe-setup-intent first.' } }, 422);
  }

  // ── Load location stripe account (must come before any Stripe calls) ────────
  // Resolves connectedAccountId, which is required for all subsequent Stripe API
  // requests. No tenant_id filter needed — location is looked up via the family's
  // primary_location_id which was itself validated through the tenant-scoped
  // membership query above.
  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('id, stripe_account_id, stripe_onboarding_status')
    .eq('id', fam.primary_location_id)
    .single();

  if (locErr || !location || !location.stripe_account_id) {
    return json({ error: { code: 'location_not_connected', message: 'Location Stripe account not configured' } }, 422);
  }

  if (location.stripe_onboarding_status !== 'connected') {
    return json({ error: { code: 'location_not_connected', message: 'Location Stripe account not fully set up' } }, 422);
  }

  const connectedAccountId = location.stripe_account_id as string;

  // ── Verify customer has at least one usable payment method ─────────────────
  // stripe_connected_customer_id is created during setup-intent flow but the
  // card is only attached after the SetupIntent confirms. Attempting subscription
  // creation with no attached card produces an immediate Stripe error — we surface
  // an actionable message instead of letting that propagate as a generic failure.
  // connectedAccountId must be resolved before this call (done above).
  {
    const pmRes = await fetch(
      `https://api.stripe.com/v1/customers/${fam.stripe_connected_customer_id}/payment_methods?type=card&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Stripe-Account': connectedAccountId,
          'Stripe-Version': STRIPE_API_VERSION,
        },
      },
    );
    if (!pmRes.ok) {
      const pmBody = await pmRes.json().catch(() => ({})) as { error?: { message?: string } };
      return json({ error: { code: 'stripe_error', message: pmBody.error?.message ?? `Could not verify payment methods (${pmRes.status})` } }, 502);
    }
    const pmData = await pmRes.json() as { data: unknown[] };
    if (!pmData.data || pmData.data.length === 0) {
      return json({ error: { code: 'no_payment_method', message: 'The customer has no attached card. Ask the family to add a payment method in the Ballpark app (Me → Payment Method) before activating billing.' } }, 422);
    }
  }

  // Idempotency: check existing subscription on Stripe
  if (mem.stripe_subscription_id) {
    try {
      const existing = await stripeGet(
        `subscriptions/${mem.stripe_subscription_id}`,
        stripeKey,
        connectedAccountId,
      );
      const subStatus = existing.status as string;
      if (subStatus === 'active' || subStatus === 'trialing' || subStatus === 'past_due') {
        console.log(`[stripe-create-subscription] already active sub=${mem.stripe_subscription_id}`);
        return json({
          subscription_id: existing.id,
          status: subStatus,
          current_period_end: existing.current_period_end,
        });
      }
    } catch {
      // Subscription doesn't exist on Stripe; fall through to create a new one
    }
  }

  // Load tenant royalty config for application_fee_percent.
  // For subscriptions, Stripe requires application_fee_percent (a percentage)
  // so it can apply the platform fee on every renewal invoice automatically.
  // (PaymentIntents use application_fee_amount in cents; subscriptions use percent.)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('royalty_config')
    .eq('id', mem.tenant_id)
    .single();

  const royaltyConfig = (tenant?.royalty_config as Record<string, unknown> | null) ?? {};
  const applicationFeePct = (royaltyConfig.fee_percent as number | undefined) ?? 6;

  // ── Canonical Price ID: plan-level lookup-or-create ──────────────────────
  // One canonical Stripe Price per (plan_name + amount_cents + connected account).
  // On first activation for a given plan, we create the Price and store it on
  // the membership row. Subsequent memberships on the SAME plan look up an
  // existing price from another row with the same plan_name + amount_cents +
  // primary_location_id, avoiding price sprawl across members on identical plans.
  let canonicalPriceId: string = (mem as unknown as Record<string, unknown>).stripe_price_id as string ?? '';

  if (canonicalPriceId) {
    // Verify the stored Price still exists and is active on the connected account
    try {
      const existingPrice = await stripeGet(`prices/${canonicalPriceId}`, stripeKey, connectedAccountId);
      if (existingPrice.active !== true) {
        canonicalPriceId = ''; // Price archived — fall through to plan-level lookup
      }
    } catch {
      canonicalPriceId = ''; // Price not found on Stripe — fall through
    }
  }

  if (!canonicalPriceId) {
    // Plan-level lookup: find another membership at the SAME LOCATION (connected account)
    // that already has a stripe_price_id. Filtering on primary_location_id ensures we only
    // reuse Prices that belong to the same connected Stripe account — a Price on account A
    // cannot be used on account B, so cross-account siblings would always fail validation
    // and cause unnecessary fallback price creation (price sprawl).
    const { data: siblingWithPrice } = await supabase
      .from('memberships')
      .select('stripe_price_id, families!inner(primary_location_id)')
      .eq('tenant_id', mem.tenant_id)
      .eq('plan_name', mem.plan_name)
      .eq('amount_cents', mem.amount_cents)
      .eq('families.primary_location_id', fam.primary_location_id)
      .neq('id', membership_id)
      .not('stripe_price_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (siblingWithPrice?.stripe_price_id) {
      // Validate the sibling's price is still active on the connected account
      try {
        const sibPrice = await stripeGet(
          `prices/${siblingWithPrice.stripe_price_id}`,
          stripeKey,
          connectedAccountId,
        );
        if (sibPrice.active === true) {
          canonicalPriceId = siblingWithPrice.stripe_price_id as string;
          console.log(`[stripe-create-subscription] reusing plan-level price=${canonicalPriceId} for plan=${mem.plan_name}`);
        }
      } catch {
        // Sibling price not found or not active — create fresh below
      }
    }
  }

  if (!canonicalPriceId) {
    // Create a new canonical Price on the connected account for this plan.
    const newPrice = await stripePost('prices', stripeKey, {
      unit_amount: mem.amount_cents,
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: { name: mem.plan_name },
      metadata: {
        tenant_id: mem.tenant_id,
        plan_name: mem.plan_name,
      },
    }, connectedAccountId);

    canonicalPriceId = newPrice.id as string;
    console.log(`[stripe-create-subscription] created plan-level price=${canonicalPriceId} plan=${mem.plan_name}`);
  }

  // Persist the canonical Price ID on this membership row (enables plan-level
  // reuse for the next member on this same plan).
  await supabase
    .from('memberships')
    .update({ stripe_price_id: canonicalPriceId, updated_at: new Date().toISOString() })
    .eq('id', membership_id)
    .eq('tenant_id', callerTenantId);

  // Build subscription params.
  // application_fee_percent lets Stripe apply the platform royalty percentage
  // to every renewal invoice automatically (unlike application_fee_amount which
  // is a one-time fixed amount used on PaymentIntents).
  // on_behalf_of ensures the charge appears as the location's business on the
  // customer's statement and the connected account bears the Stripe fee.
  const subParams: Record<string, unknown> = {
    customer: fam.stripe_connected_customer_id,
    'items[0][price]': canonicalPriceId,
    'off_session': 'true',
    'payment_behavior': 'default_incomplete',
    'application_fee_percent': applicationFeePct,
    'on_behalf_of': connectedAccountId,
    'metadata[membership_id]': mem.id,
    'metadata[tenant_id]': mem.tenant_id,
    'metadata[kid_name]': [kid.first_name, kid.last_name].filter(Boolean).join(' '),
    'expand[0]': 'latest_invoice.payment_intent',
  };

  // Apply promotion code if provided (Stripe PromotionCode id, not coupon id).
  // promotion_code applies the discount to the first billing period.
  if (stripe_promotion_code_id) {
    subParams.promotion_code = stripe_promotion_code_id;
  }

  // Set billing_cycle_anchor if we have a billing_anchor_day
  if (mem.billing_anchor_day) {
    const now = new Date();
    const anchor = new Date(now.getFullYear(), now.getMonth(), mem.billing_anchor_day);
    if (anchor <= now) {
      anchor.setMonth(anchor.getMonth() + 1);
    }
    subParams['billing_cycle_anchor'] = Math.floor(anchor.getTime() / 1000);
    subParams['proration_behavior'] = 'none';
  }

  const subscription = await stripePost('subscriptions', stripeKey, subParams, connectedAccountId);

  const currentPeriodEnd = subscription.current_period_end as number;
  const nextBillingAt = new Date(currentPeriodEnd * 1000).toISOString();
  const stripeStatus = subscription.status as string;

  // Map Stripe subscription status → DB membership status.
  // We do NOT unconditionally force 'active' because the first invoice may be
  // incomplete/past_due (e.g., card requires authentication or first charge fails).
  // The webhook will reconcile status further as events arrive, but we start with
  // an accurate status based on what Stripe actually returned.
  let dbStatus: string;
  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    dbStatus = 'active';
  } else if (stripeStatus === 'incomplete' || stripeStatus === 'past_due') {
    dbStatus = 'payment_overdue';
  } else {
    // incomplete_expired, unpaid, cancelled, etc.
    dbStatus = 'payment_overdue';
  }

  // Persist subscription_id + next_billing_at to the membership (tenant-scoped for safety)
  const { error: updateErr } = await supabase
    .from('memberships')
    .update({
      stripe_subscription_id: subscription.id as string,
      next_billing_at: nextBillingAt,
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership_id)
    .eq('tenant_id', callerTenantId);

  if (updateErr) {
    console.error(`[stripe-create-subscription] DB update failed: ${updateErr.message}`);
    // Don't fail — subscription was created, just log
  }

  console.log(`[stripe-create-subscription] created sub=${subscription.id} membership=${membership_id} tenant=${callerTenantId}`);

  return json({
    subscription_id: subscription.id,
    status: subscription.status,
    current_period_end: currentPeriodEnd,
    next_billing_at: nextBillingAt,
  });
});
