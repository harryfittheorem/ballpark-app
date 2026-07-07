import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getFailedPayments } from '@/lib/supabase/ownerQueries';
import { FailedPaymentsContent } from './FailedPaymentsContent';

export default async function FailedPaymentsPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const payments = await getFailedPayments(supabase, tenantId);
  return <FailedPaymentsContent payments={payments} />;
}
