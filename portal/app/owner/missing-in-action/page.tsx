import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getMissingInAction } from '@/lib/supabase/ownerQueries';
import { MissingInActionContent } from './MissingInActionContent';

export default async function MissingInActionPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const groups = await getMissingInAction(supabase, tenantId);
  return <MissingInActionContent groups={groups} />;
}
