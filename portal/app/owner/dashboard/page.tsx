import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getTodayAtAGlanceData, getTenantName } from '@/lib/supabase/ownerQueries';
import { TodayDashboardContent } from './TodayDashboardContent';

export const metadata = {
  title: 'Today at a Glance — Ballpark',
};

export default async function TodayDashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';

  const [data, tenantName] = await Promise.all([
    getTodayAtAGlanceData(supabase, tenantId),
    getTenantName(supabase, tenantId),
  ]);

  return <TodayDashboardContent data={data} tenantName={tenantName} />;
}
