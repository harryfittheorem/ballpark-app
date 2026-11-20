export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getCancelledMemberships } from '@/lib/supabase/ownerQueries';
import { CancellationsContent } from './CancellationsContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function CancellationsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; since?: string }>;
}) {
  const params = await searchParams;

  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();

  const preset = params.preset ?? '30';
  let since: Date;

  if (params.since) {
    since = new Date(params.since);
    if (isNaN(since.getTime())) since = new Date(Date.now() - 30 * 86_400_000);
  } else {
    const days = preset === '90' ? 90 : preset === 'all' ? 365 : 30;
    since = new Date(Date.now() - days * 86_400_000);
  }

  const memberships = await getCancelledMemberships(supabase, tenantId, since);

  return (
    <CancellationsContent
      memberships={memberships}
      activePreset={params.since ? 'custom' : preset}
      sinceIso={since.toISOString()}
    />
  );
}
