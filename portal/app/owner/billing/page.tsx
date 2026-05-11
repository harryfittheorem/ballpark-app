import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getBillingData } from '@/lib/supabase/ownerQueries';
import { BillingContent } from './BillingContent';

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';
  const data = await getBillingData(supabase, tenantId);
  return <BillingContent data={data} />;
}
