import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getFailedPayments } from '@/lib/supabase/ownerQueries';
import { FailedPaymentsContent } from './FailedPaymentsContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function FailedPaymentsPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();
  const payments = await getFailedPayments(supabase, tenantId);
  return <FailedPaymentsContent payments={payments} />;
}
