import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId, readAppRole, type AppRole } from '@/lib/auth';
import { getTenantName, getTenantNameBySlug } from '@/lib/supabase/ownerQueries';

export const metadata = {
  title: 'Owner Portal — Ballpark',
};

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?reason=unauthenticated');

  const { data: { session } } = await supabase.auth.getSession();

  // Decode JWT role; fall back to app_metadata for tokens that predate the
  // Custom Access Token Hook (same pattern used in admin/layout.tsx).
  let role = readAppRole(session);
  if (role === 'parent' && user.app_metadata?.app_role) {
    const meta = user.app_metadata.app_role as string;
    const known: AppRole[] = ['owner', 'admin', 'super_admin', 'coach', 'parent'];
    if (known.includes(meta as AppRole)) role = meta as AppRole;
  }

  if (role === 'coach') redirect('/coach/inbox');
  if (role === 'admin' || role === 'super_admin') redirect('/admin');
  if (role !== 'owner') redirect('/login?reason=unauthenticated');

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
    <PortalShell
      role="owner"
      email={user?.email ?? null}
      userName={userName}
      locationName={locationName}
    >
      {children}
    </PortalShell>
  );
}
