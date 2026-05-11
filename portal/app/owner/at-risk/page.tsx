import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getOwnerMembers } from '@/lib/supabase/ownerQueries';
import { AtRiskContent } from './AtRiskContent';

export default async function AtRiskPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const members = await getOwnerMembers(supabase, tenantId);
  return <AtRiskContent members={members} />;
}
