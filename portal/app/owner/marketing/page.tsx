import { requireOwnerContext } from '@/lib/ownerAccess';
import { MarketingContent } from './MarketingContent';

export default async function MarketingPage() {
  await requireOwnerContext();
  return <MarketingContent />;
}
