/**
 * GET /api/owner/membership-plans
 *
 * Returns active membership plans for the current owner's tenant.
 * Used by the enrollment kiosk to populate the plan-selection step.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type MembershipPlan = {
  id: string;
  name: string;
  plan_type: 'eft' | 'otc';
  amount_cents: number;
  description: string | null;
  sort_order: number;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = readTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'No tenant in session' }, { status: 401 });

  const { data, error } = await supabase
    .from('membership_plans')
    .select('id, name, plan_type, amount_cents, description, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } });
}
