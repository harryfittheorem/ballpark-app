import { requireOwnerContext } from '@/lib/ownerAccess';
import { getRetentionDataset } from '@/lib/retention/queries';
import { RetentionContent } from './RetentionContent';

export default async function RetentionPage() {
  const { client, tenantId } = await requireOwnerContext();
  const data = await getRetentionDataset(client, { kind: 'owner', tenantId });
  return <RetentionContent data={data} />;
}
