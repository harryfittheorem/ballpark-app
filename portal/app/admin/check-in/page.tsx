import { schedulingActor } from '@/lib/scheduling';
import { CheckInBoard } from './CheckInBoard';
import { fetchCheckInRoster, fetchCheckInWaitlistCounts } from './actions';

export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const { tenantId } = await schedulingActor();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [bookings, waitlistCounts] = await Promise.all([
    fetchCheckInRoster(start.toISOString(), end.toISOString()),
    fetchCheckInWaitlistCounts(start.toISOString(), end.toISOString()),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">Check-In</h1>
        <p className="mt-1 text-sm text-text-light">Today’s roster · Manual attendance · Scheduled and actual instructors tracked separately</p>
      </div>
      <CheckInBoard initialBookings={bookings} waitlistCounts={waitlistCounts} tenantId={tenantId} />
    </div>
  );
}
