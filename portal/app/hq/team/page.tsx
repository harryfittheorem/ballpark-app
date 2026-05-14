import { createClient } from '@/lib/supabase/server';
import { getHQTeam, getHQLocations } from '@/lib/supabase/hqQueries';
import { HQTeamContent } from './HQTeamContent';

export default async function HQTeamPage() {
  const supabase = await createClient();
  const [team, locations] = await Promise.all([
    getHQTeam(supabase),
    getHQLocations(supabase),
  ]);
  return <HQTeamContent team={team} locations={locations} />;
}
