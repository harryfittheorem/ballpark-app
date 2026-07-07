import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getMissingInAction } from '@/lib/supabase/ownerQueries';
import { MissingInActionContent } from './MissingInActionContent';

export default async function MissingInActionPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const groups = await getMissingInAction(supabase, tenantId);
  return <MissingInActionContent groups={groups} />;
}
