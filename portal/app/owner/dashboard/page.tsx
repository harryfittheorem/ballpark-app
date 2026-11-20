import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getTodayAtAGlanceData, getTenantName } from '@/lib/supabase/ownerQueries';
import { TodayDashboardContent } from './TodayDashboardContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export const metadata = {
  title: 'Today — Clubhouse by Infinite Hitting',
};

export default async function TodayDashboardPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();

  const [data, tenantName] = await Promise.all([
    getTodayAtAGlanceData(supabase, tenantId),
    getTenantName(supabase, tenantId),
  ]);

  return <TodayDashboardContent data={data} tenantName={tenantName} />;
}
