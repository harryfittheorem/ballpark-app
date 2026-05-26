export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getCancelledMemberships } from '@/lib/supabase/ownerQueries';
import { CancellationsContent } from './CancellationsContent';

export default async function CancellationsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; since?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';

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
