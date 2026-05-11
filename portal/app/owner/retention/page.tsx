import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getRetentionData } from '@/lib/supabase/ownerQueries';
import { RetentionContent } from './RetentionContent';

export default async function RetentionPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const data = await getRetentionData(supabase, tenantId);
  return <RetentionContent data={data} />;
}
