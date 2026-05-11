import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getOwnerCoaches } from '@/lib/supabase/ownerQueries';
import { CoachesContent } from './CoachesContent';

export default async function CoachesPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const coaches = await getOwnerCoaches(supabase, tenantId);
  return <CoachesContent coaches={coaches} />;
}
