import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getMissingInAction } from '@/lib/supabase/ownerQueries';
import { MissingInActionContent } from './MissingInActionContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function MissingInActionPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();
  const groups = await getMissingInAction(supabase, tenantId);
  return <MissingInActionContent groups={groups} />;
}
