import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';

/** Service-role readers must never infer an owner's tenant from environment config. */
export const requireOwnerContext = cache(async () => {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect('/login?reason=unauthenticated');
  const { data: { session } } = await client.auth.getSession();
  const role = readAppRole(session);
  const effectiveRole = role === 'parent' ? user.app_metadata?.app_role : role;
  if (effectiveRole !== 'owner') {
    if (effectiveRole === 'super_admin') redirect('/hq');
    if (effectiveRole === 'admin') redirect('/admin');
    if (effectiveRole === 'coach') redirect('/coach/inbox');
    redirect('/logout?reason=parent');
  }
  const tenantId = readTenantId(session);
  if (!tenantId) redirect('/login?reason=missing-tenant');
  return { client, user, session, tenantId };
});
