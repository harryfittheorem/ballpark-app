import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getRetentionData } from '@/lib/supabase/ownerQueries';
import { ChurnAnalysisContent } from './ChurnAnalysisContent';

export default async function ChurnAnalysisPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const data = await getRetentionData(supabase, tenantId);
  return <ChurnAnalysisContent data={data} />;
}
