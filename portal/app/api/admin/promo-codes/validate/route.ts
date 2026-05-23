/**
 * POST /api/admin/promo-codes/validate
 *
 * Read-only promo code check for the membership activation UI discount preview.
 * Does NOT consume the code (no redemptions_used increment).
 * Actual atomic consumption happens in /api/memberships/activate after Stripe succeeds.
 *
 * Body: { code: string, plan_name?: string }
 *   plan_name — the membership's plan_name (e.g. "Elite Monthly"). When provided,
 *   PLAN_MISMATCH fires if the code has applicable_plan_names set and this plan is
 *   not in the list.
 *
 * Returns:
 *   { ok: true, discount_type, discount_value, stripe_promotion_code_id, code }
 *   { ok: false, error_code: 'INVALID'|'EXPIRED'|'EXHAUSTED'|'PLAN_MISMATCH'|'FORBIDDEN' }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return err(401, 'Unauthorized');
  const role = readAppRole(session);
  if (role !== 'admin' && role !== 'owner') return err(403, 'Forbidden');

  let body: { code?: string; plan_name?: string };
  try {
    body = await req.json();
  } catch {
    return err(400, 'Invalid JSON');
  }

  const code = (body.code ?? '').trim();
  if (!code) return err(422, 'code is required');

  // Pass plan_name as p_plan_name so PLAN_MISMATCH fires when applicable_plan_names
  // is set and this plan is not in the allowed list.
  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_code: code,
    p_plan_name: body.plan_name?.trim() ?? null,
  });

  if (error) {
    console.error('[promo-codes/validate] RPC error:', error.message);
    return err(500, error.message);
  }

  return NextResponse.json(data as Record<string, unknown>);
}
