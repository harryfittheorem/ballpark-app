import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getExpiringPacks } from '@/lib/supabase/ownerQueries';
import { ExpiringPacksContent } from './ExpiringPacksContent';

export default async function ExpiringPacksPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const packs = await getExpiringPacks(supabase, tenantId);
  return <ExpiringPacksContent packs={packs} />;
}
