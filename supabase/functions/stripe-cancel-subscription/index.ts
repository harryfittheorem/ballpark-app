// =============================================================================
// supabase/functions/stripe-cancel-subscription/index.ts
// =============================================================================
// Task #189 — Stripe Connect Phase 3: Cancel a recurring membership subscription
//
// Auth model: Standard Supabase JWT required (admin or owner role only).
// Tenant isolation: caller's tenant_id (from JWT app_metadata) must match
// the target membership's tenant_id. The service-role membership query is
// scoped to BOTH membership_id AND tenant_id, preventing cross-tenant access.
//
// Deploy with:
//   npx supabase functions deploy stripe-cancel-subscription
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

function encodeFormBody(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
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
    const err = data.error as { message?: string; code?: string } | undefined;
    if ((err as { code?: string })?.code === 'resource_missing') {
      throw Object.assign(new Error(err?.message ?? 'Not found'), { code: 'resource_missing' });
    }
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

  let body: { membership_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: { code: 'bad_json', message: 'Invalid request body' } }, 400);
  }

  const { membership_id } = body;
  if (!membership_id) {
    return json({ error: { code: 'missing_param', message: 'membership_id required' } }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Load membership — scoped to BOTH membership_id AND caller's tenant_id (tenant isolation)
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select(`
      id, stripe_subscription_id, status, tenant_id, family_id,
      families!inner(id, primary_location_id)
    `)
    .eq('id', membership_id)
    .eq('tenant_id', callerTenantId)
    .single();

  if (memErr || !mem) {
    return json({ error: { code: 'not_found', message: 'Membership not found or access denied' } }, 404);
  }

  if (!mem.stripe_subscription_id) {
    // No Stripe subscription — just mark as cancelled in DB (tenant-scoped update)
    await supabase
      .from('memberships')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', membership_id)
      .eq('tenant_id', callerTenantId);
    return json({ ok: true, cancel_at_period_end: false, cancelled_immediately: true });
  }

  const fam = mem.families as unknown as { id: string; primary_location_id: string };

  const { data: location } = await supabase
    .from('locations')
    .select('stripe_account_id')
    .eq('id', fam.primary_location_id)
    .single();

  const connectedAccountId = location?.stripe_account_id as string | null;

  try {
    // Cancel at period end (family keeps access until the end of the period paid for)
    const cancelled = await stripePost(
      `subscriptions/${mem.stripe_subscription_id}`,
      stripeKey,
      { cancel_at_period_end: 'true' },
      connectedAccountId ?? undefined,
    );

    const cancelAt = cancelled.cancel_at
      ? new Date((cancelled.cancel_at as number) * 1000).toISOString()
      : null;

    // Persist cancel_at to the membership row so the portal can show a consistent
    // "Cancels on <date>" badge across page reloads without re-querying Stripe.
    await supabase
      .from('memberships')
      .update({ cancel_at: cancelAt, updated_at: new Date().toISOString() })
      .eq('id', membership_id)
      .eq('tenant_id', callerTenantId);

    console.log(`[stripe-cancel-subscription] sub=${mem.stripe_subscription_id} cancel_at=${cancelAt} tenant=${callerTenantId}`);

    return json({
      ok: true,
      cancel_at_period_end: true,
      cancel_at: cancelAt,
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'resource_missing') {
      // Subscription already gone — clean up DB (tenant-scoped)
      await supabase
        .from('memberships')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', membership_id)
        .eq('tenant_id', callerTenantId);
      return json({ ok: true, cancel_at_period_end: false, cancelled_immediately: true });
    }
    console.error(`[stripe-cancel-subscription] Stripe error: ${e.message}`);
    return json({ error: { code: 'stripe_error', message: e.message } }, 500);
  }
});
