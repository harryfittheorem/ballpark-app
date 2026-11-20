import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Legacy role-view selection never grants network access. */
export default async function FranchisorDashboard() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const verified = await client.from('super_admins').select('id').eq('user_id', user.id).maybeSingle();
  if (verified.error || !verified.data) redirect('/owner/churn-analysis');
  redirect('/hq/churn-analysis');
}
