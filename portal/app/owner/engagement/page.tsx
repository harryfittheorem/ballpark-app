import { requireOwnerContext } from '@/lib/ownerAccess';
import { getOwnerMembers } from '@/lib/supabase/ownerQueries';
import { EngagementContent } from './EngagementContent';

export default async function EngagementPage() {
  const { client, tenantId } = await requireOwnerContext();
  const members = await getOwnerMembers(client, tenantId);
  return <EngagementContent members={members} />;
}
