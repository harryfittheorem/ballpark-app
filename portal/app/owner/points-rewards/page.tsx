import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getPointsRewardsData } from '@/lib/supabase/ownerQueries';
import { PointsRewardsContent } from './PointsRewardsContent';

export default async function PointsRewardsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const data = await getPointsRewardsData(supabase, tenantId);
  return <PointsRewardsContent data={data} />;
}
