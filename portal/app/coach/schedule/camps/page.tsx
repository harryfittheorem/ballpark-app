import { redirect } from 'next/navigation';
import { schedulingActor } from '@/lib/scheduling';
import { getCoachCapabilities, isStaffPreset } from '@/lib/auth';
import { CampManager } from '@/app/owner/schedule/camps/CampManager';

export default async function CoachCampsPage() {
  const { client, userId } = await schedulingActor();
  if (!isStaffPreset(await getCoachCapabilities(client, userId))) redirect('/coach');
  return <CampManager basePath="/coach/schedule" checkInHref="/coach/check-in" />;
}
