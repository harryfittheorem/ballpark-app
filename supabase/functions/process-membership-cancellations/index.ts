// =============================================================================
// supabase/functions/process-membership-cancellations/index.ts
// =============================================================================
// Task #238 — Cancellation Policy Enforcement
// Task #519 — Wire up cancellation cron (improved logging)
//
// Daily cron (scheduled via pg_cron 0 2 * * *) that finalises memberships
// whose cancel_effective_at <= NOW():
//   1. Cancels the Stripe subscription immediately (not at period end — it
//      already reached the effective date the parent was shown).
//   2. Sets memberships.status = 'cancelled' and memberships.cancelled_at = now().
//
// Safe to invoke manually for testing:
//   curl -X POST https://<project>.supabase.co/functions/v1/process-membership-cancellations \
//     -H "Authorization: Bearer <service_role_key>"
//
// Returns HTTP 200 with { processed: N, cancelled: N, errors: [...] }
//
// Deploy:
//   npx supabase functions deploy process-membership-cancellations
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

function encodeFormBody(obj: Record<string, string | boolean | number>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}

async function stripeDel(
  path: string,
  secretKey: string,
  stripeAccountId?: string | null,
): Promise<{ id: string; status: string }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'DELETE',
    headers,
    body: encodeFormBody({}),
  });

  if (res.status === 404) {
    // Already gone — treat as success
    return { id: path.split('/').pop() ?? '', status: 'canceled' };
  }

  const data = await res.json() as { id?: string; status?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe error ${res.status}`);
  }
  return { id: data.id ?? '', status: data.status ?? 'canceled' };
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
    return json({ error: 'POST only' }, 405);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, serviceKey);

  // Load all memberships that are due for cancellation
  const { data: memberships, error: fetchErr } = await supabase
    .from('memberships')
    .select(`
      id, tenant_id, stripe_subscription_id, cancel_effective_at,
      families!inner(id, primary_location_id)
    `)
    .not('cancel_effective_at', 'is', null)
    .lte('cancel_effective_at', new Date().toISOString())
    .neq('status', 'cancelled');

  if (fetchErr) {
    console.error('[process-membership-cancellations] fetch error:', fetchErr.message);
    return json({ error: fetchErr.message }, 500);
  }

  if (!memberships || memberships.length === 0) {
    console.log('[process-membership-cancellations] no eligible memberships — done');
    return json({ processed: 0, cancelled: 0, errors: [] });
  }

  console.log(`[process-membership-cancellations] processing ${memberships.length} membership(s)`);

  let cancelled = 0;
  const errors: { id: string; error: string }[] = [];

  for (const mem of memberships) {
    try {
      let stripeAccountId: string | null = null;

      if (mem.stripe_subscription_id && stripeKey) {
        // Resolve connected Stripe account for this location
        const fam = mem.families as unknown as { id: string; primary_location_id: string };
        if (fam?.primary_location_id) {
          const { data: loc } = await supabase
            .from('locations')
            .select('stripe_account_id')
            .eq('id', fam.primary_location_id)
            .single();
          stripeAccountId = (loc?.stripe_account_id as string | null) ?? null;
        }

        // Cancel the Stripe subscription immediately
        await stripeDel(
          `subscriptions/${mem.stripe_subscription_id}`,
          stripeKey,
          stripeAccountId,
        );
        console.log(`[process-membership-cancellations] Stripe sub ${mem.stripe_subscription_id} cancelled`);
      } else if (!stripeKey) {
        console.warn(`[process-membership-cancellations] STRIPE_SECRET_KEY not set — skipping Stripe cancellation for ${mem.id}`);
      }

      // Update DB: mark cancelled
      const { error: updateErr } = await supabase
        .from('memberships')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', mem.id)
        .eq('tenant_id', mem.tenant_id);

      if (updateErr) {
        console.error(`[process-membership-cancellations] DB update error for ${mem.id}:`, updateErr.message);
        errors.push({ id: mem.id, error: updateErr.message });
        continue;
      }

      cancelled++;
      console.log(`[process-membership-cancellations] membership ${mem.id} → cancelled`);
    } catch (err) {
      const e = err as Error;
      console.error(`[process-membership-cancellations] error for ${mem.id}:`, e.message);
      errors.push({ id: mem.id, error: e.message });
    }
  }

  const summary = {
    processed: memberships.length,
    cancelled,
    skipped: memberships.length - cancelled - errors.length,
    errors,
  };
  console.log('[process-membership-cancellations] run complete:', JSON.stringify(summary));
  return json(summary);
});
