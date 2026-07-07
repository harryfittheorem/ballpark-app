// =============================================================================
// supabase/functions/resume-membership/index.ts
// =============================================================================
// Task #240 — Membership pause flow — manual early resume
//
// Auth model: Supabase JWT required. Accepts parent OR owner/admin role.
//   - parent: can only resume their own family's membership.
//   - owner/admin: can resume any membership in their tenant.
//
// Authorization is enforced inside the resume_membership() SECURITY DEFINER RPC,
// which derives identity from auth.jwt() / auth.uid() — no caller-supplied role params.
//
// Deploy with:
//   npx supabase functions deploy resume-membership
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function stripeRemovePause(
  subscriptionId: string,
  secretKey: string,
  stripeAccountId?: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  // Sending pause_collection= (empty string) removes the pause from the subscription.
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'POST',
    headers,
    body: 'pause_collection=',
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
  }
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
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

  // ── Verify JWT ────────────────────────────────────────────────────────────
  const authHeader  = req.headers.get('Authorization') ?? '';
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

  const userRole     = (user.app_metadata?.app_role as string | undefined)
    ?? (user.user_metadata?.app_role as string | undefined) ?? '';
  // The Custom Access Token Hook injects tenant_id into the JWT payload only —
  // NOT into raw_app_meta_data. Decode the token directly; fall back to
  // app_metadata for environments where the hook is absent.
  const callerTenant: string | null = (() => {
    try {
      const parts = callerToken.split('.');
      if (parts.length < 2) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
      return (payload.tenant_id as string | undefined)
        ?? (user.app_metadata?.tenant_id as string | undefined)
        ?? null;
    } catch {
      return (user.app_metadata?.tenant_id as string | undefined) ?? null;
    }
  })();

  // Accept any authenticated user. If the role claim is absent (Custom Access
  // Token Hook not running in this environment), we fall back to treating the
  // caller as a parent and enforce ownership via fam.parent_user_id below.

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { membership_id?: string };
  try { body = await req.json(); } catch {
    return json({ error: { code: 'bad_json', message: 'Invalid request body' } }, 400);
  }

  const { membership_id } = body;
  if (!membership_id) {
    return json({ error: { code: 'missing_param', message: 'membership_id required' } }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Pre-flight: load membership (service-role, for Stripe details) ────────
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select(`
      id, status, stripe_subscription_id, tenant_id, family_id,
      families!inner(id, parent_user_id, primary_location_id)
    `)
    .eq('id', membership_id)
    .single();

  if (memErr || !mem) {
    return json({ error: { code: 'not_found', message: 'Membership not found' } }, 404);
  }

  // ── Pre-flight scope check (mirrors RPC check) ────────────────────────────
  const fam = mem.families as unknown as { id: string; parent_user_id: string; primary_location_id: string };

  const isOwnerAdmin = ['owner', 'admin'].includes(userRole);
  if (isOwnerAdmin) {
    if (!callerTenant || mem.tenant_id !== callerTenant) {
      return json({ error: { code: 'forbidden', message: 'Access denied — tenant mismatch' } }, 403);
    }
  } else {
    // parent or missing role claim: verify family ownership
    if (fam.parent_user_id !== user.id) {
      return json({ error: { code: 'forbidden', message: 'Access denied' } }, 403);
    }
  }

  if (mem.status !== 'paused') {
    return json({ error: { code: 'not_paused', message: 'Membership is not paused' } }, 409);
  }

  // ── Resolve Stripe connected account ──────────────────────────────────────
  const { data: location } = await supabase
    .from('locations')
    .select('stripe_account_id')
    .eq('id', fam.primary_location_id)
    .single();

  const connectedAccountId = location?.stripe_account_id as string | null;

  // ── Remove Stripe pause ───────────────────────────────────────────────────
  if (mem.stripe_subscription_id) {
    try {
      await stripeRemovePause(
        mem.stripe_subscription_id as string,
        stripeKey,
        connectedAccountId ?? undefined,
      );
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : 'Unknown Stripe error';
      console.error(`[resume-membership] Stripe error: ${msg}`);
      return json({ error: { code: 'stripe_error', message: msg } }, 502);
    }
  }

  // ── Update DB via SECURITY DEFINER RPC (JWT-derived auth inside RPC) ─────
  // The RPC re-derives auth from the caller's JWT token.
  const { data: rpcResult, error: rpcErr } = await callerClient.rpc('resume_membership', {
    p_membership_id: membership_id,
  });

  if (rpcErr) {
    console.error(`[resume-membership] RPC error: ${rpcErr.message}`);
    return json({ error: { code: 'db_error', message: 'Stripe resumed but DB update failed — contact support' } }, 500);
  }

  const result = rpcResult as { ok: boolean; code?: string };
  if (!result.ok) {
    console.error(`[resume-membership] RPC rejected: ${result.code}`);
    return json({ error: { code: result.code ?? 'rpc_error', message: 'DB update rejected' } }, 500);
  }

  console.log(`[resume-membership] resumed membership=${membership_id}`);

  return json({ ok: true });
});
