import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getOwnerMembers } from '@/lib/supabase/ownerQueries';
import { MembersContent } from './MembersContent';

export default async function MembersPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const members = await getOwnerMembers(supabase, tenantId);
  return <MembersContent members={members} />;
}
