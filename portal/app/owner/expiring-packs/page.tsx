import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getExpiringPacks } from '@/lib/supabase/ownerQueries';
import { ExpiringPacksContent } from './ExpiringPacksContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function ExpiringPacksPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();
  const packs = await getExpiringPacks(supabase, tenantId);
  return <ExpiringPacksContent packs={packs} />;
}
