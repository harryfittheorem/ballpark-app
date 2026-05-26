import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getLowBalancePacks } from '@/lib/supabase/ownerQueries';
import { LowBalancePacksContent } from './LowBalancePacksContent';

export default async function LowBalancePacksPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const packs = await getLowBalancePacks(supabase, tenantId);
  return <LowBalancePacksContent packs={packs} />;
}
