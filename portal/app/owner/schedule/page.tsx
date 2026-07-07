import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getOwnerScheduleData } from '@/lib/supabase/ownerQueries';
import { ScheduleContent } from './ScheduleContent';

export default async function SchedulePage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const data = await getOwnerScheduleData(supabase, tenantId);
  return <ScheduleContent data={data} tenantId={tenantId} />;
}
