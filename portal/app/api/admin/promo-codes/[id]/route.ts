/**
 * PATCH /api/admin/promo-codes/[id]
 * Toggle is_active. Also deactivates/reactivates the Stripe PromotionCode.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_VERSION = '2024-06-20';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function stripeRequest(
  method: 'POST',
  path: string,
  secretKey: string,
  body?: Record<string, unknown>,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Stripe-Version': STRIPE_VERSION,
  };
  const init: RequestInit = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const parts: string[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    }
    init.body = parts.join('&');
  }
  await fetch(`https://api.stripe.com/v1/${path}`, init);
  // Best-effort — don't throw on Stripe errors for toggle
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return err(401, 'Unauthorized');
  const role = readAppRole(session);
  if (role !== 'admin' && role !== 'owner') return err(403, 'Forbidden');
  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  const { id } = await params;

  let body: { is_active?: boolean };
  try {
    body = await req.json();
  } catch {
    return err(400, 'Invalid JSON');
  }

  if (typeof body.is_active !== 'boolean') {
    return err(422, 'is_active (boolean) required');
  }

  // Load the existing row so we know the Stripe promotion code ID
  const { data: existing, error: fetchErr } = await supabase
    .from('promo_codes')
    .select('id, stripe_promotion_code_id, is_active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !existing) return err(404, 'Promo code not found');

  // Update DB
  const { data: updated, error: updateErr } = await supabase
    .from('promo_codes')
    .update({ is_active: body.is_active })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateErr) return err(500, updateErr.message);

  // Sync to Stripe PromotionCode (best-effort)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && existing.stripe_promotion_code_id) {
    await stripeRequest(
      'POST',
      `promotion_codes/${existing.stripe_promotion_code_id}`,
      stripeKey,
      { active: body.is_active ? 'true' : 'false' },
    );
  }

  return NextResponse.json({ code: updated });
}
