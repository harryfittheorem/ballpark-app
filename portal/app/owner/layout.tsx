import type { ReactNode } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { requireOwnerContext } from '@/lib/ownerAccess';
import { getTenantName, getPaymentPausedCount } from '@/lib/supabase/ownerQueries';

export const metadata = { title: 'Owner Portal — Clubhouse by Infinite Hitting' };

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const { user, tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();
  const [locationName, paymentPausedCount] = await Promise.all([
    getTenantName(supabase, tenantId),
    getPaymentPausedCount(supabase, tenantId),
  ]);
  const fullName = user.user_metadata?.full_name;
  const userName = typeof fullName === 'string' && fullName ? fullName : user.email ?? 'Owner';
  return <PortalShell role="owner" email={user.email ?? null} userName={userName}
    locationName={locationName} paymentPausedCount={paymentPausedCount}>
    <div className="owner-responsive-content" style={{ color: '#FAF6E8' }}>{children}</div>
  </PortalShell>;
}
