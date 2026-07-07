import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getCoachHours } from '@/lib/supabase/ownerQueries';
import { CoachHoursContent } from './CoachHoursContent';

export default async function CoachHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';

  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const defaultStart = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}-${String(twelveMonthsAgo.getDate()).padStart(2, '0')}`;
  const defaultEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const startDate = params.start ?? defaultStart;
  const endDate   = params.end   ?? defaultEnd;

  const rows = await getCoachHours(supabase, tenantId, startDate, endDate);

  return (
    <CoachHoursContent
      rows={rows}
      startDate={startDate}
      endDate={endDate}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
    />
  );
}
