import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getOwnerScheduleData } from '@/lib/supabase/ownerQueries';
import { ScheduleContent } from './ScheduleContent';

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const data = await getOwnerScheduleData(supabase, tenantId);
  return <ScheduleContent data={data} tenantId={tenantId} />;
}
