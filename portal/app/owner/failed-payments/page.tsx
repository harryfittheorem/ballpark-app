import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getFailedPayments } from '@/lib/supabase/ownerQueries';
import { FailedPaymentsContent } from './FailedPaymentsContent';

export default async function FailedPaymentsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const payments = await getFailedPayments(supabase, tenantId);
  return <FailedPaymentsContent payments={payments} />;
}
