import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getOwnerMembers } from '@/lib/supabase/ownerQueries';
import { AtRiskContent } from './AtRiskContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function AtRiskPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();
  const members = await getOwnerMembers(supabase, tenantId);
  return <AtRiskContent members={members} />;
}
