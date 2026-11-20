import { requireOwnerContext } from '@/lib/ownerAccess';
import { getRetentionDataset } from '@/lib/retention/queries';
import { ChurnAnalysisContent } from './ChurnAnalysisContent';

export default async function ChurnAnalysisPage() {
  const { client, tenantId } = await requireOwnerContext();
  const data = await getRetentionDataset(client, { kind: 'owner', tenantId });
  return <ChurnAnalysisContent data={data} />;
}
