/**
 * POST /api/owner/memberships/[id]/retry-payment
 *
 * Staff-initiated immediate Stripe retry for a failed membership payment.
 * Finds the subscription's existing open or draft invoice and pays it
 * (finalizing first if still a draft). Falls back to creating a new invoice
 * only when no outstanding invoice exists.
 *
 * Auth: owner or admin role required.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION = '2024-06-20';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function stripeGet(
  path: string,
  secretKey: string,
  stripeAccountId?: string | null,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers });
  const data = await res.json() as Record<string, unknown>;
  return { ok: res.ok, data };
}

async function stripePost(
  path: string,
  body: Record<string, string>,
  secretKey: string,
  stripeAccountId?: string | null,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const encoded = Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers,
    body: encoded,
  });
  const data = await res.json() as Record<string, unknown>;
  return { ok: res.ok, data };
}

/**
 * Resolve the invoice to pay for a given subscription.
 * Priority: open → draft (finalize it) → create new (finalize it).
 * Returns { invoiceId, status } or throws on unrecoverable error.
 */
async function resolveInvoiceToPay(
  subId: string,
  secretKey: string,
  stripeAccountId: string | null,
): Promise<string> {
  // 1. Look for an existing open invoice (ready to pay immediately)
  const { ok: openOk, data: openList } = await stripeGet(
    `invoices?subscription=${encodeURIComponent(subId)}&status=open&limit=1`,
    secretKey,
    stripeAccountId,
  );
  if (openOk) {
    const openData = openList.data as Array<{ id: string }> | undefined;
    if (openData && openData.length > 0) {
      return openData[0].id;
    }
  }

  // 2. Look for a draft invoice and finalize it
  const { ok: draftOk, data: draftList } = await stripeGet(
    `invoices?subscription=${encodeURIComponent(subId)}&status=draft&limit=1`,
    secretKey,
    stripeAccountId,
  );
  if (draftOk) {
    const draftData = draftList.data as Array<{ id: string }> | undefined;
    if (draftData && draftData.length > 0) {
      const draftId = draftData[0].id;
      const { ok: finalOk, data: finalData } = await stripePost(
        `invoices/${draftId}/finalize`,
        {},
        secretKey,
        stripeAccountId,
      );
      if (!finalOk) {
        const msg = (finalData.error as { message?: string } | undefined)?.message ?? 'Stripe error';
        throw new Error(`Failed to finalize draft invoice ${draftId}: ${msg}`);
      }
      return draftId;
    }
  }

  // 3. No outstanding invoice — create one, then finalize it.
  // Stripe requires `customer` on invoice creation (subscription alone is not
  // sufficient), so look it up from the subscription first.
  const { ok: subOk, data: subData } = await stripeGet(
    `subscriptions/${encodeURIComponent(subId)}`,
    secretKey,
    stripeAccountId,
  );
  if (!subOk) {
    const msg = (subData.error as { message?: string } | undefined)?.message ?? 'Stripe error';
    throw new Error(`Failed to look up subscription ${subId}: ${msg}`);
  }
  const customerId = subData.customer as string | undefined;
  if (!customerId) {
    throw new Error(`Subscription ${subId} has no associated customer`);
  }

  const { ok: createOk, data: createData } = await stripePost(
    'invoices',
    { subscription: subId, customer: customerId, auto_advance: 'false' },
    secretKey,
    stripeAccountId,
  );
  if (!createOk) {
    const msg = (createData.error as { message?: string } | undefined)?.message ?? 'Stripe error';
    throw new Error(`Failed to create invoice for sub ${subId}: ${msg}`);
  }
  const newId = createData.id as string;

  const { ok: finalOk2, data: finalData2 } = await stripePost(
    `invoices/${newId}/finalize`,
    {},
    secretKey,
    stripeAccountId,
  );
  if (!finalOk2) {
    const msg = (finalData2.error as { message?: string } | undefined)?.message ?? 'Stripe error';
    throw new Error(`Failed to finalize new invoice ${newId}: ${msg}`);
  }

  return newId;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: membershipId } = await params;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return err(500, 'Stripe not configured');

  const serviceClient = createServiceClient();

  const { data: mem, error: memErr } = await serviceClient
    .from('memberships')
    .select(`
      id, status, stripe_subscription_id, plan_name,
      families!inner(primary_location_id)
    `)
    .eq('id', membershipId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (memErr || !mem) return err(404, 'Membership not found');

  const subId = mem.stripe_subscription_id as string | null;
  if (!subId) return err(422, 'No Stripe subscription attached to this membership');

  const fam = mem.families as unknown as { primary_location_id: string };
  const { data: loc } = await serviceClient
    .from('locations')
    .select('stripe_account_id')
    .eq('id', fam.primary_location_id)
    .maybeSingle();

  const stripeAccountId = (loc?.stripe_account_id as string | null) ?? null;

  let invoiceId: string;
  try {
    invoiceId = await resolveInvoiceToPay(subId, stripeKey, stripeAccountId);
  } catch (resolveErr) {
    const msg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
    return err(502, msg);
  }

  const { ok: payOk, data: payData } = await stripePost(
    `invoices/${invoiceId}/pay`,
    {},
    stripeKey,
    stripeAccountId,
  );

  if (!payOk) {
    const payErr = (payData.error as { message?: string } | undefined)?.message ?? 'Stripe error';
    return NextResponse.json({
      ok: false,
      message: `Invoice found (${invoiceId}) but payment attempt failed: ${payErr}`,
      invoice_id: invoiceId,
    }, { status: 422 });
  }

  console.log(`[retry-payment] membership=${membershipId} invoice=${invoiceId} status=${payData.status}`);
  return NextResponse.json({
    ok: true,
    invoice_id: invoiceId,
    status: payData.status,
    message: `Retry initiated. Invoice ${invoiceId} status: ${payData.status}`,
  });
}
