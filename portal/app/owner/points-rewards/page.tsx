import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getPointsRewardsData } from '@/lib/supabase/ownerQueries';
import { PointsRewardsContent } from './PointsRewardsContent';

export default async function PointsRewardsPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const data = await getPointsRewardsData(supabase, tenantId);
  return <PointsRewardsContent data={data} />;
}
