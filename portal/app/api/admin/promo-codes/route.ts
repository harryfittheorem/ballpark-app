/**
 * GET  /api/admin/promo-codes  — list all codes for the caller's tenant
 * POST /api/admin/promo-codes  — create a Stripe Coupon + PromotionCode, then insert DB row
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

/**
 * Encodes a potentially-nested object for Stripe's form-encoded API.
 * Nested objects use bracket notation: metadata[key]=value.
 * encodeURIComponent encodes brackets as %5B/%5D, which Stripe correctly decodes.
 */
function encodeForm(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
      const nested = encodeForm(v as Record<string, unknown>, key);
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
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_VERSION,
    },
    body: encodeForm(body),
  });
  const data = await res.json() as Record<string, unknown>;
  return { ok: res.ok, data };
}

async function stripePost2(
  path: string,
  secretKey: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await stripePost(path, secretKey, body);
  if (!res.ok) {
    const errObj = res.data.error as { message?: string } | undefined;
    throw new Error(errObj?.message ?? `Stripe error on ${path}`);
  }
  return res.data;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: err(401, 'Unauthorized') };
  const role = readAppRole(session);
  if (role !== 'admin' && role !== 'owner') return { error: err(403, 'Forbidden') };
  const tenantId = readTenantId(session);
  if (!tenantId) return { error: err(401, 'No tenant in session') };
  return { supabase, tenantId };
}

// ── GET — list codes ───────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase, tenantId } = auth;

  const { data, error } = await supabase
    .from('promo_codes')
    .select('id, code, discount_type, discount_value, max_redemptions, redemptions_used, applicable_plan_names, expires_at, is_active, created_at, stripe_coupon_id, stripe_promotion_code_id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return err(500, error.message);
  return NextResponse.json({ codes: data ?? [] });
}

// ── POST — create code ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase, tenantId } = auth;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return err(500, 'Stripe not configured');

  let body: {
    code?: string;
    discount_type?: string;
    discount_value?: number;
    max_redemptions?: number | null;
    expires_at?: string | null;
    applicable_plan_names?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return err(400, 'Invalid JSON');
  }

  const code = (body.code ?? '').trim().toUpperCase();
  if (!code) return err(422, 'code is required');
  if (code.length < 2 || code.length > 50) return err(422, 'code must be 2–50 characters');
  if (!/^[A-Z0-9_-]+$/.test(code)) return err(422, 'code may only contain letters, numbers, underscores, and hyphens');

  const discountType = body.discount_type;
  if (discountType !== 'percent' && discountType !== 'fixed') {
    return err(422, 'discount_type must be percent or fixed');
  }

  const discountValue = Number(body.discount_value);
  if (!Number.isInteger(discountValue) || discountValue <= 0) {
    return err(422, 'discount_value must be a positive integer');
  }
  if (discountType === 'percent' && discountValue > 100) {
    return err(422, 'percent discount cannot exceed 100');
  }

  const maxRedemptions = body.max_redemptions != null ? Number(body.max_redemptions) : null;
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)) {
    return err(422, 'max_redemptions must be a positive integer or omitted');
  }

  const expiresAt = body.expires_at ? new Date(body.expires_at) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return err(422, 'expires_at is not a valid date');

  const applicablePlanNames: string[] = Array.isArray(body.applicable_plan_names)
    ? (body.applicable_plan_names as unknown[]).filter((n): n is string => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim())
    : [];

  // ── Create Stripe Coupon ───────────────────────────────────────────────────
  const couponParams: Record<string, unknown> = {
    name: code,
    ...(discountType === 'percent'
      ? { percent_off: discountValue }
      : { amount_off: discountValue, currency: 'usd' }),
    duration: 'once',
    metadata: { tenant_id: tenantId, ballpark_code: code },
  };
  if (maxRedemptions !== null) couponParams.max_redemptions = maxRedemptions;
  if (expiresAt) couponParams.redeem_by = Math.floor(expiresAt.getTime() / 1000);

  let coupon: Record<string, unknown>;
  try {
    coupon = await stripePost2('coupons', stripeKey, couponParams);
  } catch (e) {
    return err(502, `Stripe coupon creation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Create Stripe PromotionCode ────────────────────────────────────────────
  const promoParams: Record<string, unknown> = {
    coupon: coupon.id as string,
    code,
    metadata: { tenant_id: tenantId },
  };
  if (maxRedemptions !== null) promoParams.max_redemptions = maxRedemptions;
  if (expiresAt) promoParams.expires_at = Math.floor(expiresAt.getTime() / 1000);

  let promoCode: Record<string, unknown>;
  try {
    promoCode = await stripePost2('promotion_codes', stripeKey, promoParams);
  } catch (e) {
    return err(502, `Stripe promotion code creation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Insert DB row ──────────────────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from('promo_codes')
    .insert({
      tenant_id: tenantId,
      code,
      stripe_coupon_id: coupon.id as string,
      stripe_promotion_code_id: promoCode.id as string,
      discount_type: discountType,
      discount_value: discountValue,
      max_redemptions: maxRedemptions,
      expires_at: expiresAt?.toISOString() ?? null,
      applicable_plan_names: applicablePlanNames,
      is_active: true,
    })
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return err(409, `A promo code "${code}" already exists for this tenant`);
    }
    return err(500, `DB insert failed: ${insertErr.message}`);
  }

  return NextResponse.json({ code: inserted }, { status: 201 });
}
