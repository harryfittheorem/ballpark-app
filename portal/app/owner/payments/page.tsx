import { Suspense } from 'react';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getLocationsStripeStatus } from '@/lib/supabase/ownerQueries';
import { PaymentsContent } from './PaymentsContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function PaymentsPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();
  const locations = await getLocationsStripeStatus(supabase, tenantId);
  return (
    <Suspense fallback={null}>
      <PaymentsContent locations={locations} />
    </Suspense>
  );
}
