import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getFranchisorPerformance } from '@/lib/supabase/hqQueries';
import { FranchisorContent } from './FranchisorContent';

export default async function FranchisorDashboard() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const verified = await client.from('super_admins').select('id').eq('user_id', user.id).maybeSingle();
  if (verified.error || !verified.data) redirect('/owner');

  const serviceClient = createServiceClient();
  const networkData = await getFranchisorPerformance(serviceClient);
  return <FranchisorContent data={networkData} />;
}
