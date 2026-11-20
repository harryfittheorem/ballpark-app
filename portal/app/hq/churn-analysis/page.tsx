import { createClient } from '@/lib/supabase/server';
import { getRetentionDataset } from '@/lib/retention/queries';

export default async function NetworkChurnPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await createClient();
  const data = await getRetentionDataset(client, { kind: 'network' });
  // Do not send player-level network evidence across the browser boundary.
  // The aggregate-only network presentation is rendered server-side below.
  const { NetworkRetentionContent } = await import('./NetworkRetentionContent');
  return <NetworkRetentionContent data={data} searchParams={await searchParams} />;
}
