import { requireOwnerContext } from '@/lib/ownerAccess';
import { getRetentionDataset } from '@/lib/retention/queries';
import { getLTVData } from '@/lib/supabase/ownerQueries';
import { RetentionContent } from './RetentionContent';

export default async function RetentionPage() {
  const { client, tenantId } = await requireOwnerContext();
  const [data, ltvData, networkData] = await Promise.all([
    getRetentionDataset(client, { kind: 'owner', tenantId }),
    getLTVData(client, tenantId),
    getRetentionDataset(client, { kind: 'network' }).catch(() => null),
  ]);
  return <RetentionContent data={data} ltvData={ltvData} networkData={networkData} />;
}
