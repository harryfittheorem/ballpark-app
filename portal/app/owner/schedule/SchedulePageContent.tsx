import { schedulingActor } from '@/lib/scheduling';
import { fetchScheduleRange } from './actions';
import { ScheduleContent } from './ScheduleContent';

export async function SchedulePageContent({ basePath = '/owner/schedule' }: { basePath?: string }) {
  const { tenantId } = await schedulingActor();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const result = await fetchScheduleRange(start.toISOString(), end.toISOString());
  const data = { bookings: result.bookings, totalToday: result.bookings.length, occupancyPct: 0, openSlots: 0 };
  return <ScheduleContent data={data} tenantId={tenantId} basePath={basePath} />;
}
