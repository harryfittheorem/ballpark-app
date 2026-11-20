import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getOwnerMembers } from '@/lib/supabase/ownerQueries';
import { MembersContent } from './MembersContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();

  const members = await getOwnerMembers(supabase, tenantId);

  return <MembersContent members={members} />;
}
