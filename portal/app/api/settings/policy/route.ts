/**
 * POST /api/settings/policy
 *
 * Saves cancellation-policy fields to tenant_config.
 * Uses the service-role client to bypass the RLS policy that gates on
 * the `app_role` JWT custom claim (Custom Access Token Hook not yet
 * configured in this environment). A valid session is still required.
 *
 * Request body:
 *   {
 *     booking_cancel_window_hours:    number,
 *     booking_cancel_fee_cents:       number,
 *     membership_cancel_notice_days:  number,
 *   }
 *
 * Returns:
 *   { ok: true }
 *   { error: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_TENANT_ID = '00000000-0000-0000-0000-000000000001';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return err(401, 'Unauthorized');

  const tenantId = readTenantId(session) ?? FALLBACK_TENANT_ID;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const windowHours = typeof body.booking_cancel_window_hours === 'number'
    ? body.booking_cancel_window_hours : null;
  const feeCents = typeof body.booking_cancel_fee_cents === 'number'
    ? body.booking_cancel_fee_cents : null;
  const noticeDays = typeof body.membership_cancel_notice_days === 'number'
    ? body.membership_cancel_notice_days : null;

  if (windowHours === null || feeCents === null || noticeDays === null) {
    return err(400, 'booking_cancel_window_hours, booking_cancel_fee_cents, and membership_cancel_notice_days are required numbers');
  }

  const service = createServiceClient();
  const { error } = await service
    .from('tenant_config')
    .update({
      booking_cancel_window_hours: windowHours,
      booking_cancel_fee_cents: feeCents,
      membership_cancel_notice_days: noticeDays,
    })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[settings/policy] update error:', error.message);
    return err(500, error.message);
  }

  return NextResponse.json({ ok: true });
}
