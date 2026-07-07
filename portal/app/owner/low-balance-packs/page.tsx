import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getLowBalancePacks } from '@/lib/supabase/ownerQueries';
import { LowBalancePacksContent } from './LowBalancePacksContent';

export default async function LowBalancePacksPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const packs = await getLowBalancePacks(supabase, tenantId);
  return <LowBalancePacksContent packs={packs} />;
}
