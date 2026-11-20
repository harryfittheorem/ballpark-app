import { schedulingActor } from '@/lib/scheduling';
import { CampManager } from './CampManager';

export default async function CampsPage() {
  await schedulingActor();
  return <CampManager />;
}
