import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getRevenueReportsData } from '@/lib/supabase/ownerQueries';
import { RevenueReportsContent } from './RevenueReportsContent';

export default async function RevenueReportsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const data = await getRevenueReportsData(supabase, tenantId);
  return <RevenueReportsContent data={data} />;
}
