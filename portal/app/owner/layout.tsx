import type { ReactNode } from 'react';
import { OwnerShell } from '@/components/owner/OwnerShell';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getTenantName, getTenantNameBySlug } from '@/lib/supabase/ownerQueries';

export const metadata = {
  title: 'Owner Portal — Ballpark',
};

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const tenantId = readTenantId(session);

  let locationName = 'Your Location';
  if (tenantId) {
    locationName = await getTenantName(supabase, tenantId);
  } else {
    const slug = session?.user?.user_metadata?.tenant_slug as string | undefined;
    if (slug) {
      const serviceClient = createServiceClient();
      locationName = await getTenantNameBySlug(serviceClient, slug);
    }
  }

  const rawFullName = session?.user?.user_metadata?.full_name;
  const userName =
    (typeof rawFullName === 'string' && rawFullName.length > 0 ? rawFullName : undefined)
    ?? session?.user?.email
    ?? 'Owner';

  return (
    <OwnerShell locationName={locationName} userName={userName}>
      {children}
    </OwnerShell>
  );
}
