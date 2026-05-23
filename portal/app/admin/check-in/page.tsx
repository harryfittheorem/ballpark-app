import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { CheckInBoard, type CheckInBooking } from './CheckInBoard';

export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect('/login?reason=unauthenticated');
  if (readAppRole(session) !== 'admin') redirect('/logout?reason=forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) redirect('/logout?reason=no-tenant');

  // Today's bookings in the admin's tenant (RLS scopes by staff_locations)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: rows } = await supabase
    .from('bookings')
    .select(
      `id, scheduled_start, scheduled_end, cage_number, status, attended_at,
       kid:kid_id(first_name, last_name),
       coach:coach_id(first_name, last_name),
       session_type:session_type_id(name)`,
    )
    .eq('tenant_id', tenantId)
    .gte('scheduled_start', todayStart.toISOString())
    .lte('scheduled_start', todayEnd.toISOString())
    .not('status', 'in', '("cancelled")')
    .order('scheduled_start');

  type RawRow = {
    id: string;
    scheduled_start: string;
    scheduled_end: string;
    cage_number: string | null;
    status: string;
    attended_at: string | null;
    kid: { first_name: string | null; last_name: string | null } | null;
    coach: { first_name: string | null; last_name: string | null } | null;
    session_type: { name: string | null } | null;
  };

  const bookings: CheckInBooking[] = ((rows ?? []) as unknown as RawRow[]).map((r) => ({
    id: r.id,
    scheduled_start: r.scheduled_start,
    scheduled_end: r.scheduled_end,
    cage_number: r.cage_number,
    status: r.status,
    attended_at: r.attended_at,
    kid_first_name: r.kid?.first_name ?? null,
    kid_last_name: r.kid?.last_name ?? null,
    coach_first_name: r.coach?.first_name ?? null,
    coach_last_name: r.coach?.last_name ?? null,
    session_type_name: r.session_type?.name ?? null,
  }));

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Check-In
        </h1>
        <p className="mt-1 text-sm text-text-light">
          {today} · {bookings.length} booking{bookings.length !== 1 ? 's' : ''} today
        </p>
      </div>

      <CheckInBoard initialBookings={bookings} tenantId={tenantId} />
    </div>
  );
}
