import { createClient } from '@/lib/supabase/server';
import { getHQLocations } from '@/lib/supabase/hqQueries';
import { HQLocationsContent } from './HQLocationsContent';

export default async function HQLocationsPage() {
  const supabase = await createClient();
  const locations = await getHQLocations(supabase);
  return <HQLocationsContent locations={locations} />;
}
