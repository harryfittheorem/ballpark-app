import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getRetentionData } from '@/lib/supabase/ownerQueries';
import { RetentionContent } from './RetentionContent';

export default async function RetentionPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const data = await getRetentionData(supabase, tenantId);
  return <RetentionContent data={data} />;
}
