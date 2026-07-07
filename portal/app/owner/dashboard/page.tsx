import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getTodayAtAGlanceData, getTenantName } from '@/lib/supabase/ownerQueries';
import { TodayDashboardContent } from './TodayDashboardContent';

export const metadata = {
  title: 'Today at a Glance — Ballpark',
};

export default async function TodayDashboardPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';

  const [data, tenantName] = await Promise.all([
    getTodayAtAGlanceData(supabase, tenantId),
    getTenantName(supabase, tenantId),
  ]);

  return <TodayDashboardContent data={data} tenantName={tenantName} />;
}
