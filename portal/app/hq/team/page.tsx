import { createClient } from '@/lib/supabase/server';
import { getHQTeam, getHQLocations, getHQPendingInvites } from '@/lib/supabase/hqQueries';
import { HQTeamContent } from './HQTeamContent';

export default async function HQTeamPage() {
  const supabase = await createClient();
  const [team, locations, pendingInvites] = await Promise.all([
    getHQTeam(supabase),
    getHQLocations(supabase),
    getHQPendingInvites(supabase),
  ]);
  return <HQTeamContent team={team} locations={locations} pendingInvites={pendingInvites} />;
}
