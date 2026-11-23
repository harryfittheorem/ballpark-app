import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getFranchisorPerformance } from '@/lib/supabase/hqQueries';
import { LocationProfileContent } from './LocationProfileContent';

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const verified = await client.from('super_admins').select('id').eq('user_id', user.id).maybeSingle();
  if (verified.error || !verified.data) redirect('/owner');

  const serviceClient = createServiceClient();
  const networkData = await getFranchisorPerformance(serviceClient);

  const location = networkData.locations.find(l => l.locationId === id) ?? networkData.locations[0];
  const rank = networkData.locations.findIndex(l => l.locationId === id) + 1;

  return (
    <LocationProfileContent
      location={location}
      rank={rank || 1}
      totalLocations={networkData.locations.length}
      networkAvgMrr={networkData.totalMrr / (networkData.locations.length || 1)}
      networkAvgMembers={networkData.totalMembers / (networkData.locations.length || 1)}
    />
  );
}
