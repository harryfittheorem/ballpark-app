import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { SetupContent } from './SetupContent';

export const metadata = { title: 'Platform Setup — Ballpark' };

/**
 * One-time bootstrap page. Closes permanently once platform_init is set.
 * Accessible without authentication (the platform hasn't been initialized yet).
 */
export default async function PlatformSetupPage() {
  const serviceClient = createServiceClient();

  const { data: initRow } = await serviceClient
    .from('platform_init')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (initRow) {
    // Platform already initialized — this page is permanently closed.
    redirect('/login?reason=already_initialized');
  }

  return <SetupContent />;
}
