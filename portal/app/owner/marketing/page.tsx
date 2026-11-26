import { requireOwnerContext } from '@/lib/ownerAccess';
import { MarketingContent } from './MarketingContent';

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  await requireOwnerContext();
  const params = await searchParams;
  return <MarketingContent preview={params.preview === '1'} />;
}
