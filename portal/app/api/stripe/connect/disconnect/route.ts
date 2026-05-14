/**
 * POST /api/stripe/connect/disconnect
 *
 * Clears the Stripe connection for a location (for testing / re-onboarding).
 * Does NOT call Stripe's deauthorize endpoint — the operator must do that
 * manually in the Stripe Dashboard if they want to fully revoke access.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

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
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  const body = await req.json().catch(() => ({})) as { location_id?: string };
  const locationId = body.location_id as string | undefined;
  if (!locationId) return err(400, 'location_id is required');

  // Verify the location belongs to the owner's tenant using the user client
  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('id, tenant_id')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .single();

  if (locErr || !location) return err(404, 'Location not found');

  // Clear Stripe fields using service-role client
  const svc = createServiceClient();
  const { error: dbErr } = await svc
    .from('locations')
    .update({
      stripe_account_id: null,
      stripe_onboarding_status: 'not_connected',
      stripe_account_name: null,
      stripe_payout_interval: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', locationId);

  if (dbErr) return err(500, `Database update failed: ${dbErr.message}`);

  return NextResponse.json({ ok: true });
}
