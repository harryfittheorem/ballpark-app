import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getOwnerCoaches } from '@/lib/supabase/ownerQueries';
import { CoachesContent } from './CoachesContent';

export default async function CoachesPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const coaches = await getOwnerCoaches(supabase, tenantId);
  return <CoachesContent coaches={coaches} tenantId={tenantId} />;
}
