import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getLocationsStripeStatus } from '@/lib/supabase/ownerQueries';
import { PaymentsContent } from './PaymentsContent';

export default async function PaymentsPage() {
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  const locations = await getLocationsStripeStatus(supabase, tenantId);
  return (
    <Suspense fallback={null}>
      <PaymentsContent locations={locations} />
    </Suspense>
  );
}
