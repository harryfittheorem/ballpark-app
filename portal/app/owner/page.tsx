import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import {
  getOwnerMembers,
  getOwnerKPIs,
  getMonthlyRevenue,
  getMembershipPackages,
  getTenantName,
} from '@/lib/supabase/ownerQueries';
import { DashboardContent } from './DashboardContent';

export default async function OwnerDashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';

  const [members, kpis, revenueMonthly, packages, tenantName] = await Promise.all([
    getOwnerMembers(supabase, tenantId),
    getOwnerKPIs(supabase, tenantId),
    getMonthlyRevenue(supabase, tenantId),
    getMembershipPackages(supabase, tenantId),
    getTenantName(supabase, tenantId),
  ]);

  return (
    <DashboardContent
      kpis={kpis}
      members={members}
      revenueMonthly={revenueMonthly}
      packages={packages}
      locationName={tenantName}
      tenantName={tenantName}
    />
  );
}
