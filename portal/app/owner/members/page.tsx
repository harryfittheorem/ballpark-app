import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getOwnerMembers } from '@/lib/supabase/ownerQueries';
import { MembersContent } from './MembersContent';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session)
    ?? process.env.PORTAL_TENANT_ID
    ?? '00000000-0000-0000-0000-000000000001';

  console.log('[MembersPage] tenantId:', tenantId, '| session:', !!session);

  const members = await getOwnerMembers(supabase, tenantId);

  console.log('[MembersPage] DB members count:', members.length);

  return <MembersContent members={members} />;
}
