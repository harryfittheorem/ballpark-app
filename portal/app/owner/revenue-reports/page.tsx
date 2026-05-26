import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getRevenueReportsData, getRevenueTransactions } from '@/lib/supabase/ownerQueries';
import { RevenueReportsContent } from './RevenueReportsContent';

export default async function RevenueReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 86_400_000);
  const defaultStart = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}-${String(twelveMonthsAgo.getDate()).padStart(2, '0')}`;
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const startDate = params.start ?? defaultStart;
  const endDate   = params.end   ?? defaultEnd;

  const [data, transactions] = await Promise.all([
    getRevenueReportsData(supabase, tenantId),
    getRevenueTransactions(supabase, tenantId, startDate, endDate),
  ]);

  return (
    <RevenueReportsContent
      data={data}
      transactions={transactions}
      startDate={startDate}
      endDate={endDate}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
    />
  );
}
