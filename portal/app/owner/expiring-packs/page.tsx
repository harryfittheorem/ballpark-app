import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getExpiringPacks } from '@/lib/supabase/ownerQueries';
import { ExpiringPacksContent } from './ExpiringPacksContent';

export default async function ExpiringPacksPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const packs = await getExpiringPacks(supabase, tenantId);
  return <ExpiringPacksContent packs={packs} />;
}
