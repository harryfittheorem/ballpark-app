import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { CheckInBoard, type CheckInBooking, type WaitlistCount } from './CheckInBoard';

export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?reason=unauthenticated');

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Resolve role — JWT claim with app_metadata fallback, then user_metadata
  // fallback for owner accounts (raw_user_meta_data → user_metadata in JS SDK)
  let role = readAppRole(session);
  if (role === 'parent' && user.app_metadata?.app_role) {
    role = user.app_metadata.app_role as ReturnType<typeof readAppRole>;
  }
  if (role === 'parent' && user.user_metadata?.app_role) {
    role = user.user_metadata.app_role as ReturnType<typeof readAppRole>;
  }
  if (role !== 'admin' && role !== 'owner' && role !== 'super_admin') {
    redirect('/logout?reason=forbidden');
  }

  // Resolve tenantId — JWT claim with user_metadata fallback for production
  let tenantId = readTenantId(session);
  if (!tenantId && user.app_metadata?.tenant_id) {
    tenantId = user.app_metadata.tenant_id as string;
  }
  if (!tenantId && user.user_metadata?.tenant_id) {
    tenantId = user.user_metadata.tenant_id as string;
  }
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

  // Waitlist counts grouped by hour label — matches how CheckInBoard groups rows
  const { data: waitlistRows } = await supabase
    .from('booking_waitlist')
    .select('scheduled_start')
    .eq('tenant_id', tenantId)
    .in('status', ['waiting', 'notified'])
    .gte('scheduled_start', todayStart.toISOString())
    .lte('scheduled_start', todayEnd.toISOString());

  function toHourLabel(iso: string): string {
    const d = new Date(iso);
    const h24 = d.getHours();
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:00 ${period}`;
  }

  const hourCounts = new Map<string, number>();
  for (const row of waitlistRows ?? []) {
    const label = toHourLabel(row.scheduled_start);
    hourCounts.set(label, (hourCounts.get(label) ?? 0) + 1);
  }
  const waitlistCounts: WaitlistCount[] = Array.from(hourCounts.entries()).map(
    ([hour_label, count]) => ({ hour_label, count }),
  );

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const totalWaitlist = waitlistRows?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Check-In
        </h1>
        <p className="mt-1 text-sm text-text-light">
          {today} · {bookings.length} booking{bookings.length !== 1 ? 's' : ''} today
          {totalWaitlist > 0 ? ` · ${totalWaitlist} on waitlist` : ''}
        </p>
      </div>

      <CheckInBoard initialBookings={bookings} waitlistCounts={waitlistCounts} tenantId={tenantId} />
    </div>
  );
}
