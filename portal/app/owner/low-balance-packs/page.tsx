import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getLowBalancePacks } from '@/lib/supabase/ownerQueries';
import { LowBalancePacksContent } from './LowBalancePacksContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function LowBalancePacksPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();
  const packs = await getLowBalancePacks(supabase, tenantId);
  return <LowBalancePacksContent packs={packs} />;
}
