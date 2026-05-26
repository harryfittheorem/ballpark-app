import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getLocationsStripeStatus } from '@/lib/supabase/ownerQueries';
import { PaymentsContent } from './PaymentsContent';

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const locations = await getLocationsStripeStatus(supabase, tenantId);
  return (
    <Suspense fallback={null}>
      <PaymentsContent locations={locations} />
    </Suspense>
  );
}
