import { schedulingActor } from '@/lib/scheduling';
import { CampManager } from '@/app/owner/schedule/camps/CampManager';

export default async function AdminCampsPage() {
  await schedulingActor();
  return <CampManager basePath="/admin/schedule" />;
}
