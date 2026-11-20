import { createServiceClient } from '@/lib/supabase/serviceClient';
import {
  getOwnerMembers,
  getOwnerKPIs,
  getMonthlyRevenue,
  getMembershipPackages,
  getTenantName,
  getLocationStripeStatus,
} from '@/lib/supabase/ownerQueries';
import { DashboardContent } from './DashboardContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function OwnerDashboardPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();

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
