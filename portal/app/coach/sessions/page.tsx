import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { CoachSessionsBoard, type CoachSession } from './CoachSessionsBoard';

export const dynamic = 'force-dynamic';

export default async function CoachSessionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?reason=unauthenticated');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const role = readAppRole(session);
  if (role !== 'coach') redirect('/login?reason=forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) redirect('/logout?reason=no-tenant');

  const { data: coachRow } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!coachRow) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          My Sessions
        </h1>
        <p className="text-sm text-text-light">No coach profile found for your account.</p>
      </div>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch today's bookings for this coach, including kid_id for assignment lookup
  const { data: rows } = await supabase
    .from('bookings')
    .select(
      `id, scheduled_start, scheduled_end, cage_number, status, attended_at, kid_id,
       kid:kid_id(first_name, last_name, age_group),
       session_type:session_type_id(name)`,
    )
    .eq('tenant_id', tenantId)
    .eq('coach_id', coachRow.id)
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
    kid_id: string;
    kid: { first_name: string | null; last_name: string | null; age_group: string | null } | null;
    session_type: { name: string | null } | null;
  };

  const bookingRows = (rows ?? []) as unknown as RawRow[];
  const kidIds = [...new Set(bookingRows.map((r) => r.kid_id))];

  // Pending assignment counts per kid for this coach
  const pendingByKid: Record<string, number> = {};
  if (kidIds.length > 0) {
    const { data: asgn } = await supabase
      .from('assignments')
      .select('kid_id')
      .eq('tenant_id', tenantId)
      .eq('coach_id', coachRow.id)
      .eq('status', 'pending')
      .in('kid_id', kidIds);

    for (const a of asgn ?? []) {
      const kId = a.kid_id as string;
      pendingByKid[kId] = (pendingByKid[kId] ?? 0) + 1;
    }
  }

  // Last completed booking notes per kid (for "last session notes")
  const lastNotesByKid: Record<string, string | null> = {};
  if (kidIds.length > 0) {
    const { data: lastBookings } = await supabase
      .from('bookings')
      .select('kid_id, notes')
      .eq('tenant_id', tenantId)
      .eq('coach_id', coachRow.id)
      .eq('status', 'completed')
      .not('notes', 'is', null)
      .in('kid_id', kidIds)
      .order('attended_at', { ascending: false });

    // Keep only the first (most recent) row per kid
    for (const lb of lastBookings ?? []) {
      const kId = lb.kid_id as string;
      if (!(kId in lastNotesByKid)) {
        lastNotesByKid[kId] = (lb.notes as string | null) ?? null;
      }
    }
  }

  const sessions: CoachSession[] = bookingRows.map((r) => ({
    id: r.id,
    scheduled_start: r.scheduled_start,
    scheduled_end: r.scheduled_end,
    cage_number: r.cage_number,
    status: r.status,
    attended_at: r.attended_at,
    kid_first_name: r.kid?.first_name ?? null,
    kid_last_name: r.kid?.last_name ?? null,
    kid_age_group: r.kid?.age_group ?? null,
    session_type_name: r.session_type?.name ?? null,
    pending_assignments: pendingByKid[r.kid_id] ?? 0,
    last_session_notes: lastNotesByKid[r.kid_id] ?? null,
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
          My Sessions Today
        </h1>
        <p className="mt-1 text-sm text-text-light">
          {today} · {sessions.length} session{sessions.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      <CoachSessionsBoard sessions={sessions} />
    </div>
  );
}
