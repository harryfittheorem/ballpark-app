import type { ReactNode } from 'react';
import { OwnerShell } from '@/components/owner/OwnerShell';
import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getTenantName } from '@/lib/supabase/ownerQueries';

export const metadata = {
  title: 'Owner Portal — Ballpark',
};

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';

  const locationName = tenantId ? await getTenantName(supabase, tenantId) : 'Your Location';
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
