import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import {
  getOwnerMembers,
  getOwnerKPIs,
  getMonthlyRevenue,
  getMembershipPackages,
  getTenantName,
  getLocationStripeStatus,
} from '@/lib/supabase/ownerQueries';
import { DashboardContent } from './DashboardContent';

export default async function OwnerDashboardPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';

  const [members, kpis, revenueMonthly, packages, tenantName, locationStripe] = await Promise.all([
    getOwnerMembers(supabase, tenantId),
    getOwnerKPIs(supabase, tenantId),
    getMonthlyRevenue(supabase, tenantId),
    getMembershipPackages(supabase, tenantId),
    getTenantName(supabase, tenantId),
    getLocationStripeStatus(supabase, tenantId),
  ]);

  const stripeConnected = locationStripe?.stripe_onboarding_status === 'connected';

  return (
    <DashboardContent
      kpis={kpis}
      members={members}
      revenueMonthly={revenueMonthly}
      packages={packages}
      locationName={tenantName}
      tenantName={tenantName}
      stripeConnected={stripeConnected}
    />
  );
}
