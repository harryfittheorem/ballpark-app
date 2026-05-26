import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { EnrollContent } from './EnrollContent';

export const metadata = {
  title: 'Enroll New Member — Ballpark',
};

export default async function EnrollPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?reason=unauthenticated');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') redirect('/owner/members');

  const tenantId = readTenantId(session) ?? '';

  // Load the active waiver for this tenant
  const serviceClient = createServiceClient();
  const { data: waiver } = await serviceClient
    .from('waivers')
    .select('id, version, effective_date, body_text')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();

  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? null;

  return (
    <EnrollContent
      waiver={waiver ? {
        id: waiver.id as string,
        version: waiver.version as number,
        effective_date: waiver.effective_date as string,
        body_text: waiver.body_text as string,
      } : null}
      stripePublishableKey={stripePublishableKey}
    />
  );
}
